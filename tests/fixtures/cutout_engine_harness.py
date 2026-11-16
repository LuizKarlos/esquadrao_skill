#!/usr/bin/env python3
"""Exercita scripts/cutout.py com cv2/numpy/rembg falsos, sem dependências nativas.

Uso: python3 tests/fixtures/cutout_engine_harness.py <caso>
Imprime um JSON com o exit code, artefato remanescente e observações do caso.
"""
import contextlib
import importlib.util
import io
import json
import os
import shutil
import sys
import tempfile
import types
from pathlib import Path

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[2]


class Arr:
    """Array falso: carrega shape e aceita as operações usadas pelo script."""

    def __init__(self, shape=(1920, 1080, 4)):
        self.shape = shape

    def __getitem__(self, _key):
        return Arr(self.shape)

    def __setitem__(self, _key, _value):
        pass

    def __gt__(self, _other):
        return Arr()

    def __eq__(self, _other):
        return Arr()

    def __or__(self, _other):
        return Arr()

    def __mul__(self, _other):
        return Arr(self.shape)

    __rmul__ = __mul__

    def __truediv__(self, _other):
        return Arr(self.shape)

    def __rtruediv__(self, _other):
        return Arr(self.shape)

    def __add__(self, _other):
        return Arr(self.shape)

    __radd__ = __add__

    def __sub__(self, _other):
        return Arr(self.shape)

    def __rsub__(self, _other):
        return Arr(self.shape)

    def astype(self, _dtype):
        return Arr(self.shape)

    def any(self):
        return False

    def tobytes(self):
        return b'\x00' * 8


class FakeStdin:
    def __init__(self):
        self.writes = 0
        self.closed = False

    def write(self, _data):
        if FakeFFmpeg.write_error is not None:
            raise FakeFFmpeg.write_error
        self.writes += 1

    def close(self):
        self.closed = True


class FakeFFmpeg:
    instances = []
    write_error = None
    exit_code = 0

    def __init__(self, cmd, stdin=None):
        self.cmd = cmd
        self.output = cmd[-1]
        self.returncode = None
        self.terminated = False
        self.killed = False
        self.stdin = FakeStdin()
        FakeFFmpeg.instances.append(self)

    def poll(self):
        return self.returncode

    def terminate(self):
        self.terminated = True
        self.returncode = -15

    def kill(self):
        self.killed = True
        self.returncode = -9

    def wait(self, timeout=None):
        if self.returncode is None:
            self.returncode = FakeFFmpeg.exit_code
            if self.returncode == 0:
                Path(self.output).touch()
        return self.returncode


class FakeSubprocess(types.ModuleType):
    PIPE = -1

    class TimeoutExpired(Exception):
        pass

    def __init__(self):
        super().__init__('subprocess')

    @staticmethod
    def run(*_args, **_kwargs):
        return types.SimpleNamespace(stdout='', returncode=0)

    @staticmethod
    def Popen(cmd, stdin=None):
        return FakeFFmpeg(cmd, stdin)


class FakeCapture:
    def __init__(self, state, sets):
        self.state = state
        self.sets = sets
        self.pos = 0
        self.released = False

    def isOpened(self):
        return True

    def get(self, prop):
        return self.state.get(prop, 0)

    def set(self, prop, value):
        self.sets.append([prop, value])
        if prop == 'CAP_PROP_POS_FRAMES':
            self.pos = int(value)
        return True

    def grab(self):
        if self.pos >= self.state.get('available', 0):
            return False
        self.pos += 1
        return True

    def read(self):
        if self.pos >= self.state.get('available', 0):
            return False, None
        self.pos += 1
        if self.state.get('read_error'):
            raise self.state['read_error']
        return True, Arr((self.state.get('height', 1920), self.state.get('width', 1080), 3))

    def release(self):
        self.released = True


CASES = {
    'ok': {},
    'broken_pipe': {'write_error': BrokenPipeError('ffmpeg morreu')},
    'engine_error': {'remove_error': RuntimeError('u2net falhou')},
    'interrupt': {'remove_error': KeyboardInterrupt()},
    'no_frames': {'available': 0},
    'short_decode': {'available': 9},
    'geometry_vertical': {'dims': (1080, 1920)},
    'geometry_horizontal': {'dims': (1920, 1080)},
    'geometry_explicit': {'dims': (1080, 1920), 'fg_height': 800},
    'kernel': {'dims': (1080, 1920)},
    'sequential': {'available': 60, 'frame_count': 60},
}


def run_case(name, cfg):
    width, height = cfg.get('dims', (1080, 1920))
    tmp = tempfile.mkdtemp(prefix='cutout-harness-')
    src = os.path.join(tmp, 'src.mp4')
    pack = os.path.join(tmp, 'pack.mp4')
    out = os.path.join(tmp, 'out.mp4')
    Path(src).write_bytes(b'')
    Path(pack).write_bytes(b'')

    resize_calls = []
    kernel_calls = []
    cap_sets = []
    pack_sets = []

    cv2 = types.ModuleType('cv2')
    for const in (
        'CAP_PROP_FPS', 'CAP_PROP_FRAME_COUNT', 'CAP_PROP_FRAME_WIDTH',
        'CAP_PROP_FRAME_HEIGHT', 'CAP_PROP_POS_FRAMES', 'CAP_PROP_POS_MSEC',
        'COLOR_BGR2RGB', 'COLOR_RGBA2BGRA', 'COLOR_BGR2BGRA',
        'GC_PR_BGD', 'GC_BGD', 'GC_PR_FGD', 'GC_FGD', 'GC_INIT_WITH_MASK',
        'MORPH_ELLIPSE', 'INTER_AREA',
    ):
        setattr(cv2, const, const)
    cv2.error = type('CvError', (Exception,), {})

    src_state = {
        'CAP_PROP_FPS': 30, 'CAP_PROP_FRAME_COUNT': cfg.get('frame_count', 30),
        'CAP_PROP_FRAME_WIDTH': width, 'CAP_PROP_FRAME_HEIGHT': height,
        'available': cfg.get('available', 30), 'width': width, 'height': height,
        'read_error': cfg.get('read_error'),
    }
    pack_state = {
        'CAP_PROP_FPS': 30, 'CAP_PROP_FRAME_COUNT': 5,
        'CAP_PROP_FRAME_WIDTH': width, 'CAP_PROP_FRAME_HEIGHT': height,
        'available': 5, 'width': width, 'height': height,
    }

    def video_capture(path):
        if path == src:
            return FakeCapture(src_state, cap_sets)
        return FakeCapture(pack_state, pack_sets)

    cv2.VideoCapture = video_capture
    cv2.cvtColor = lambda img, code: Arr(getattr(img, 'shape', (height, width, 4)))
    cv2.getStructuringElement = lambda shape, ksize: kernel_calls.append(list(ksize)) or Arr()
    cv2.erode = lambda img, kernel: Arr(img.shape)
    cv2.dilate = lambda img, kernel: Arr(img.shape)
    cv2.bitwise_not = lambda img: Arr(img.shape)
    cv2.grabCut = lambda *a, **k: None
    cv2.GaussianBlur = lambda img, ksize, sigma: Arr(img.shape)

    def resize(img, size, interpolation=None):
        resize_calls.append(list(size))
        return Arr((size[1], size[0], 4))

    cv2.resize = resize

    np = types.ModuleType('numpy')
    for const in ('uint8', 'float32', 'float64'):
        setattr(np, const, const)
    np.array = lambda value: value
    np.full = lambda shape, value, dtype=None: Arr(shape)
    np.zeros = lambda shape, dtype=None: Arr(shape)
    np.where = lambda cond, a, b: Arr()
    np.clip = lambda value, low, high: value

    pil = types.ModuleType('PIL')
    pil_image = types.ModuleType('PIL.Image')
    pil_image.fromarray = lambda value: value
    pil.Image = pil_image

    remove_error = cfg.get('remove_error')
    rembg = types.ModuleType('rembg')
    rembg.new_session = lambda model: object()

    def remove(_img, **_kwargs):
        if remove_error is not None:
            raise remove_error
        return Arr((height, width, 4))

    rembg.remove = remove

    sys.modules.update({'cv2': cv2, 'numpy': np, 'PIL': pil, 'PIL.Image': pil_image, 'rembg': rembg})
    spec = importlib.util.spec_from_file_location('cutout_under_test', ROOT / 'scripts' / 'cutout.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.subprocess = FakeSubprocess()

    FakeFFmpeg.instances.clear()
    FakeFFmpeg.write_error = cfg.get('write_error')
    FakeFFmpeg.exit_code = cfg.get('ff_exit', 0)

    argv = [
        'cutout.py', '--input', src, '--background', pack, '--output', out,
        '--fps', str(cfg.get('fps', 15)), '--width', '1080', '--height', '1920',
    ]
    if cfg.get('fg_height') is not None:
        argv += ['--fg-height', str(cfg['fg_height'])]

    stdout = io.StringIO()
    stderr = io.StringIO()
    code = 1
    old_argv = sys.argv
    sys.argv = argv
    try:
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = mod.main()
    except BaseException as exc:  # noqa: BLE001 — o harness reporta, não esconde
        stderr.write(f'\nUNCAUGHT {type(exc).__name__}: {exc}')
        code = -1
    finally:
        sys.argv = old_argv

    ff = FakeFFmpeg.instances[-1] if FakeFFmpeg.instances else None
    result = {
        'case': name,
        'exit': code,
        'output_exists': os.path.exists(out),
        'stdout': stdout.getvalue(),
        'stderr': stderr.getvalue(),
        'resize_calls': resize_calls,
        'kernel_calls': kernel_calls,
        'cap_set_calls': len(cap_sets),
        'ff_started': ff is not None,
        'ff_terminated': bool(ff and ff.terminated),
        'writes': ff.stdin.writes if ff else 0,
    }
    shutil.rmtree(tmp, ignore_errors=True)
    return result


if __name__ == '__main__':
    case = sys.argv[1]
    print(json.dumps(run_case(case, CASES[case])))
