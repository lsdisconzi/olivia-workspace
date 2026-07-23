---

## 📋 Configuration & Remote info

| Task | Command |
| :---- | :---- |
| List all configured remotes | `rclone listremotes` |
| Show config of a specific remote | `rclone config show olivia` |
| Dump **all** config (sanitised) | `rclone config dump` |
| View where the config file is | `rclone config file` |
| Edit a remote interactively | `rclone config` → choose `e` (edit) |
| Reconnect / refresh OAuth token | `rclone config reconnect olivia:` |
| Show storage used / quota | `rclone about olivia:` |

---

## 📂 Listing files

| Task | Command |
| :---- | :---- |
| Simple file list (size \+ path) | `rclone ls olivia:` |
| List **directories** only | `rclone lsd olivia:` |
| Long listing (size, modtime, path) | `rclone lsl olivia:` |
| List with MIME types | `rclone lsf --format "spm" olivia:` |
| Tree view (directories \+ files) | `rclone tree olivia:` |
| List a subfolder | `rclone ls "olivia:myfolder/subdir"` |
| Show file count / total size | `rclone size olivia:folder` |

---

## 🗑️ Deleting files & folders

| Task | Command |
| :---- | :---- |
| Delete a single file | `rclone deletefile "olivia:path/to/file.txt"` |
| Delete files matching a pattern | `rclone delete "olivia:folder" --include "*.tmp"` |
| Delete an **empty** directory | `rclone rmdir "olivia:emptydir"` |
| Delete a folder and everything inside | `rclone purge "olivia:nonempty-folder"` |
| Remove all files from a directory (keep the folder) | `rclone delete "olivia:folder"` |

⚠️ **No trash / undo** – deletions are permanent. Add `--dry-run` to see what would be removed first.

---

## 📁 Creating folders

| Task | Command |
| :---- | :---- |
| Create a single folder | `rclone mkdir "olivia:newfolder"` |
| Create a full path (parent folders included) | `rclone mkdir "olivia:a/b/c"` |

---

## 🚚 Copy, move & sync

| Task | Command |
| :---- | :---- |
| Copy local → remote (skip identical) | `rclone copy /local/folder olivia:remote/folder -P` |
| Move local → remote (delete source after) | `rclone move /local/folder olivia:remote/folder -P` |
| Sync **source → dest** (make dest match source) | `rclone sync /local/folder olivia:remote/folder` |
| Copy remote → local | `rclone copy olivia:remote/folder /local/folder` |
| Copy with bandwidth limit | `--bwlimit 1M` (1 MB/s) |
| Resume large transfers | `--transfers 4 --checkers 8` |

---

## 🔍 Useful flags (can be added to any command)

- `--dry-run` – simulate, don’t actually do anything  
- `-P` / `--progress` – show progress bar  
- `-v` / `--verbose` – more details  
- `--exclude "*.tmp"` – skip files matching pattern  
- `--max-age 24h` – only files modified within the last 24h

---

## 💡 Example: exploring the “olivia” remote

\# 1\. See config

rclone config show olivia

\# 2\. Check if accessible \+ quota

rclone about olivia:

\# 3\. List root contents

rclone lsd olivia:

\# 4\. Create a folder

rclone mkdir olivia:test-folder

\# 5\. Upload a file

rclone copy /path/to/file.txt olivia:test-folder \-P

\# 6\. Delete that folder (purge)

rclone purge olivia:test-folder

Everything above works with any remote type (Google Drive, S3, etc.). If you’d like a custom script for your specific backup workflow, just say so\!  
