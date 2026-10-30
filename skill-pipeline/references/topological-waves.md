# Topological Waves Specification

Topological wave computation partitions tasks into ordered parallel batches using Kahn's algorithm.

## Computation Algorithm

1. Calculate in-degrees (number of incoming dependencies) for each node.
2. Wave 0 contains all nodes with `in_degree == 0`.
3. Process Wave N: decrement in-degrees of dependent nodes.
4. Nodes reaching `in_degree == 0` form Wave N+1.
5. If processed node count does not equal total nodes, the graph contains cycles.

## Execution Model

- Tasks within the same wave run concurrently up to configured `max_concurrency`.
- Progression to Wave N+1 is blocked until all tasks in Wave N pass their verification gates.
