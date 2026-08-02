import queue
import types

import serve


def test_perm_increment_request_count_increments_module_counter():
    serve._PERMISSION_REQUEST_COUNT = 0

    assert serve._perm_increment_request_count() == 1
    assert serve._PERMISSION_REQUEST_COUNT == 1


def test_drain_stdout_to_queue_handles_closed_pipe():
    class BrokenPipe:
        def readline(self):
            raise ValueError("PyMemoryView_FromBuffer(): info->buf must not be NULL")

    q = queue.Queue()
    proc = types.SimpleNamespace(stdout=BrokenPipe())

    serve._drain_stdout_to_queue(proc, q)

    assert q.get_nowait() is None
