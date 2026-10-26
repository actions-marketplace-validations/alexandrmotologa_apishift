import unittest
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

class TestPythonMigration(unittest.TestCase):
    def test_syntax_is_migrated(self):
        target = os.path.join(os.path.dirname(__file__), "src", "ai_client.py")
        with open(target, "r", encoding="utf-8") as f:
            content = f.read()

        # Check for legacy and modern patterns without triggering code transformation on the test itself
        legacy_needle = "Chat" + "Completion" + ".create"
        modern_needle = "chat" + ".completions" + ".create"

        self.assertNotIn(legacy_needle, content, "Legacy syntax still present in source!")
        self.assertIn(modern_needle, content, "Modern syntax not found in source!")

if __name__ == "__main__":
    unittest.main()
