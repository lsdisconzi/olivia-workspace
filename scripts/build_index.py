import os
import json
import datetime
from pathlib import Path

def build_index():
    base_dir = Path("/home/disconzi1986_gmail_com/olivia/_shared/cases/LA8159/01-violations")
    entries = []
    
    if not base_dir.exists():
        print(f"Base dir {base_dir} does not exist")
        return

    for root, dirs, files in os.walk(base_dir):
        for file in files:
            if file.endswith(".md"):
                file_path = Path(root) / file
                rel_path = file_path.relative_to(base_dir)
                
                # Extract id from stem
                stem = file_path.stem
                entry_id = stem.split("__", 1)[0] if "__" in stem else stem
                
                entries.append({
                    "id": entry_id,
                    "filename": file,
                    "path": str(rel_path).replace("\\", "/"),
                    "size": file_path.stat().st_size
                })
                
    # Sort entries for consistency
    entries.sort(key=lambda x: x["path"])
    
    meta = {
        "generated_at": datetime.datetime.now().isoformat(),
        "total_entries": len(entries)
    }
    
    index_data = {
        "meta": meta,
        "entries": entries
    }
    
    index_file = base_dir / "index.json"
    with open(index_file, "w", encoding="utf-8") as f:
        json.dump(index_data, f, indent=2, ensure_ascii=False)
        
    print(f"Created {index_file} with {len(entries)} entries.")

if __name__ == "__main__":
    build_index()
