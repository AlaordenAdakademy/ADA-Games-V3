import json, sys

with open('data.json', 'r', encoding='utf-8') as f:
    try:
        data = json.load(f)
        print(f'JSON VALIDO - Equipos: {len(data["teams"])}')
        for t in data['teams']:
            print(f'  - {t.get("school","?")} [{t.get("category","?")}]')
    except json.JSONDecodeError as e:
        print(f'ERROR: {e}')
        with open('data.json', 'r', encoding='utf-8') as f2:
            lines = f2.readlines()
        for i in range(max(0, e.lineno-3), min(len(lines), e.lineno+3)):
            print(f'L{i+1}: {repr(lines[i])}')
