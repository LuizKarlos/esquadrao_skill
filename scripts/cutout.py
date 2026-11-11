#!/usr/bin/env python3
"""Recorte de pessoa com troca de fundo (protótipo CLI-14).

Requer: rembg, onnxruntime, opencv-python-headless, numpy, Pillow, ffmpeg.
O CLI chama este script com --python <interpretador>.
"""
import argparse
import json
import math
import subprocess
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove


def has_audio(path: str) -> bool:
    try:
        r = subprocess.run(
            ['ffprobe', '-v', 'error', '-select_streams', 'a',
             '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', path],
            capture_output=True, text=True, check=False,
        )
        return 'audio' in r.stdout
    except OSError:
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True)
    ap.add_argument('--background', required=True)
    ap.add_argument('--output', required=True)
    ap.add_argument('--fps', type=float, default=15.0)
    ap.add_argument('--width', type=int, default=1080)
    ap.add_argument('--height', type=int, default=1920)
    ap.add_argument('--fg-height', type=int, default=1000)
    ap.add_argument('--fg-y', type=int, default=None)
    ap.add_argument('--model', default='u2net_human_seg')
    ap.add_argument('--crf', type=int, default=20)
    args = ap.parse_args()

    if args.fps <= 0 or args.fps > 30:
        print('fps deve estar entre 1 e 30', file=sys.stderr)
        return 2
    if not Path(args.input).is_file():
        print(f'entrada não encontrada: {args.input}', file=sys.stderr)
        return 2
    if not Path(args.background).is_file():
        print(f'fundo não encontrado: {args.background}', file=sys.stderr)
        return 2

    cap = cv2.VideoCapture(args.input)
    pack = cv2.VideoCapture(args.background)
    if not cap.isOpened() or not pack.isOpened():
        print('não foi possível abrir entrada/fundo', file=sys.stderr)
        return 2

    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frames_total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = frames_total / src_fps if frames_total else 0
    if duration <= 0:
        print('duração inválida na entrada', file=sys.stderr)
        return 2
    out_frames = max(1, math.ceil(duration * args.fps))

    pack_fps = pack.get(cv2.CAP_PROP_FPS) or 30.0
    pack_count = max(1, int(pack.get(cv2.CAP_PROP_FRAME_COUNT) or 1))
    last_pack_idx = None

    def read_bg(i):
        nonlocal last_pack_idx
        idx = int(round(i * pack_fps / args.fps)) % pack_count
        if last_pack_idx is None or idx != last_pack_idx + 1:
            pack.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, bg = pack.read()
        if not ok:
            pack.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ok, bg = pack.read()
            idx = 0
        last_pack_idx = idx
        if not ok or bg is None:
            raise RuntimeError('falha ao ler frame do pack de fundo')
        return cv2.resize(bg, (args.width, args.height), interpolation=cv2.INTER_AREA)

    fg_h = max(1, min(args.fg_height, args.height))
    fg_y = args.height - fg_h if args.fg_y is None else max(0, min(args.fg_y, args.height - fg_h))

    audio = has_audio(args.input)
    cmd = [
        'ffmpeg', '-y', '-loglevel', 'error',
        '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', f'{args.width}x{args.height}',
        '-r', str(args.fps), '-i', '-',
        '-i', args.input,
    ]
    if audio:
        maps = ['-map', '0:v', '-map', '1:a']
    else:
        cmd += ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100']
        maps = ['-map', '0:v', '-map', '2:a']
    cmd += maps + [
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', str(args.crf),
        '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
        '-shortest', '-movflags', '+faststart', args.output,
    ]

    print(f'Carregando modelo {args.model} (primeira execução pode baixar ~176 MB)...', file=sys.stderr, flush=True)
    session = new_session(args.model)
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    started = time.time()
    written = 0

    try:
        for i in range(out_frames):
            cap.set(cv2.CAP_PROP_POS_MSEC, i * 1000.0 / args.fps)
            ok, frame = cap.read()
            if not ok:
                break
            bg = read_bg(i)
            cut = remove(
                Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)),
                session=session,
                post_process_mask=True,
            )
            # rembg devolve RGBA em RGB; OpenCV compõe em BGR. Sem esta conversão,
            # vermelho e azul trocam e a pele fica azul.
            fg = cv2.cvtColor(np.array(cut), cv2.COLOR_RGBA2BGRA)
            # Refina a máscara com GrabCut numa faixa ao redor do contorno.
            # O u2net devolve uma silhueta frouxa (15-50 px de fundo ao redor
            # da cabeça); sem refino, esse fundo vira um halo escuro no composto.
            mask = (fg[:, :, 3] > 127).astype(np.uint8) * 255
            try:
                kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
                core = cv2.erode(mask, kernel)
                outside = cv2.bitwise_not(cv2.dilate(mask, kernel))
                gc = np.full(mask.shape, cv2.GC_PR_BGD, np.uint8)
                gc[outside > 127] = cv2.GC_BGD
                gc[mask > 127] = cv2.GC_PR_FGD
                gc[core > 127] = cv2.GC_FGD
                bgm = np.zeros((1, 65), np.float64)
                fgm = np.zeros((1, 65), np.float64)
                cv2.grabCut(frame, gc, None, bgm, fgm, 1, cv2.GC_INIT_WITH_MASK)
                refined = np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
                if refined.any():
                    mask = refined
            except cv2.error:
                pass
            a = mask.astype(np.float32) / 255.0
            fg[:, :, 3] = (cv2.GaussianBlur(a, (3, 3), 0) * 255.0).astype(np.uint8)
            nw = max(1, int(fg.shape[1] * fg_h / fg.shape[0]))
            fg = cv2.resize(fg, (nw, fg_h), interpolation=cv2.INTER_AREA)
            if nw >= args.width:
                x0 = (nw - args.width) // 2
                fg = fg[:, x0:x0 + args.width]
            else:
                pad = np.zeros((fg_h, args.width, 4), dtype=np.uint8)
                x0 = (args.width - nw) // 2
                pad[:, x0:x0 + nw] = fg
                fg = pad

            alpha = (fg[:, :, 3:4].astype(np.float32) / 255.0)
            roi = bg[fg_y:fg_y + fg_h, 0:args.width].astype(np.float32)
            comp = fg[:, :, :3].astype(np.float32) * alpha + roi * (1.0 - alpha)
            bg[fg_y:fg_y + fg_h, 0:args.width] = np.clip(comp, 0, 255).astype(np.uint8)
            bgra = cv2.cvtColor(bg, cv2.COLOR_BGR2BGRA)
            ff.stdin.write(bgra.tobytes())
            written += 1
            if written % 100 == 0:
                print(f'{written}/{out_frames} frames — {time.time() - started:.1f}s', file=sys.stderr, flush=True)
        ff.stdin.close()
        rc = ff.wait()
        if rc != 0:
            print(f'ffmpeg falhou (exit {rc})', file=sys.stderr)
            return rc
    except BrokenPipeError:
        print('ffmpeg encerrou antes do fim dos frames', file=sys.stderr)
        return 1
    finally:
        cap.release()
        pack.release()

    print(json.dumps({
        'status': 'ok',
        'frames': written,
        'elapsed_s': round(time.time() - started, 1),
        'has_audio': audio,
        'output': args.output,
    }), flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
