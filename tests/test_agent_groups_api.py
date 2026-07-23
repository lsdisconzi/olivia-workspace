import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import serve


class AgentGroupsApiTests(unittest.TestCase):
    def test_catalog_lists_groups_and_agent_paths(self):
        payload = serve._agent_groups_catalog_payload()
        self.assertIn("groups", payload)
        groups = payload["groups"]
        self.assertTrue(groups)

        group_map = {group["id"]: group for group in groups}
        self.assertIn("olivia", group_map)

        olivia_group = group_map["olivia"]
        self.assertTrue(olivia_group["agents"])
        self.assertTrue(any(agent.get("path", "").endswith(".agent.md") for agent in olivia_group["agents"]))

    def test_agent_file_content_can_be_read_from_repo_relative_path(self):
        content = serve._agent_groups_file_content("agents/agents-groups/olivia/agents/olivia-coordinator.agent.md")
        self.assertIn("name:", content)
        self.assertIn("description:", content)


if __name__ == "__main__":
    unittest.main()
