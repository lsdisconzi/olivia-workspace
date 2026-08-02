import unittest

import serve


class PermissionAllowlistTests(unittest.TestCase):
    def test_filesystem_tools_are_auto_allowed(self):
        self.assertTrue(serve._should_auto_allow_permission("mcp__mcp-server-files__read_file"))
        self.assertTrue(serve._should_auto_allow_permission("read_file"))
        self.assertTrue(serve._should_auto_allow_permission("mcp__mcp-server-files__list_directory"))
        self.assertTrue(serve._should_auto_allow_permission("list_directory"))
        self.assertTrue(serve._should_auto_allow_permission("mcp__mcp-server-files__write_file"))
        self.assertTrue(serve._should_auto_allow_permission("write_file"))
        self.assertTrue(serve._should_auto_allow_permission("mcp__mcp-server-files__search_files"))
        self.assertTrue(serve._should_auto_allow_permission("search_files"))

    def test_unlisted_tools_still_require_permission(self):
        self.assertFalse(serve._should_auto_allow_permission("mcp__mcp-server-files__run_command"))
        self.assertFalse(serve._should_auto_allow_permission("run_command"))

    def test_allow_all_for_pid_enables_future_requests(self):
        pid = 424242
        self.assertFalse(serve._perm_is_allow_all_enabled(pid))
        serve._perm_enable_allow_all(pid)
        self.assertTrue(serve._perm_is_allow_all_enabled(pid))
        serve._perm_cleanup(pid)
        self.assertFalse(serve._perm_is_allow_all_enabled(pid))


if __name__ == "__main__":
    unittest.main()
