import json
import shutil
import os
from datetime import datetime

DATA_FILE = 'data.json'

# Backup first
ts = datetime.now().strftime("%H%M%S")
backup = f'data_backup_{ts}.json'
shutil.copy2(DATA_FILE, backup)
print(f'Backup: {backup}')

# Read with error recovery
with open(DATA_FILE, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Try to parse, fixing known corruption patterns
try:
    data = json.loads(content)
    print('Parsed OK on first try')
except json.JSONDecodeError as e:
    print(f'JSONDecodeError: {e}')
    # Remove corrupt lines (lines that don't look like valid JSON fragments)
    lines = content.split('\n')
    cleaned = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Skip lines that are clearly corrupt: don't start with valid JSON tokens
        # A corrupt line looks like: `"va54.68...` or `       ,`
        is_corrupt = False
        if stripped and stripped not in ['{', '}', '[', ']', '{', '}']:
            # Check if it's a key-value pair that's broken
            if stripped.startswith('"') and ':' not in stripped and not stripped.endswith((',', '{', '}', '[', ']')):
                is_corrupt = True
            # Check for bare commas with no key
            if stripped == ',':
                is_corrupt = True
        if is_corrupt:
            print(f'  Removing corrupt line {i+1}: {repr(stripped)}')
        else:
            cleaned.append(line)
    
    try:
        data = json.loads('\n'.join(cleaned))
        print(f'Parsed OK after cleaning {len(lines) - len(cleaned)} lines')
    except json.JSONDecodeError as e2:
        print(f'Still failing: {e2}')
        # Show context
        clines = '\n'.join(cleaned).split('\n')
        for j in range(max(0, e2.lineno-3), min(len(clines), e2.lineno+3)):
            print(f'  L{j+1}: {repr(clines[j])}')
        exit(1)

# Re-save with ensure_ascii=True so all encodings can read it safely
teams = data.get('teams', [])
tracks = data.get('tracks', {})
timer = data.get('timer', {"timer": 1800, "timerActive": False})

print(f'Teams: {len(teams)}')
print(f'Teams list:')
for t in teams:
    print(f'  - {t.get("school","?")} [{t.get("category","?")}]')

# Save clean
with open(DATA_FILE, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=4, ensure_ascii=True)

# Verify
with open(DATA_FILE, 'r', encoding='utf-8') as f:
    json.load(f)
print(f'\ndata.json REPARADO y GUARDADO OK')
print(f'Size: {os.path.getsize(DATA_FILE)} bytes')
