import json
import os

def sync_tracks():
    data_file = 'data.json'
    output_file = 'pistas_revision.html'

    if not os.path.exists(data_file):
        print(f"Error: {data_file} not found.")
        return

    with open(data_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    tracks_data = data.get('tracks', {})

    html_content = """<!DOCTYPE html>
<html lang='es'>
<head>
<meta charset='UTF-8'>
<style>
body { font-family: Arial, sans-serif; background: #fff; padding: 20px; font-size: 11px; }
.section-title { background: #002060; color: #fff; padding: 8px; font-weight: bold; text-align: center; text-transform: uppercase; margin: 30px 0 10px; width: fit-content; min-width: 800px; margin-left: auto; margin-right: auto; }
.card { margin-bottom: 25px; display: flex; justify-content: center; page-break-inside: avoid; }
.main-table { border: 2px solid #000; border-collapse: collapse; background: #fff; }
.main-table th, .main-table td { border: 1px solid #000; padding: 0; }

/* Rotated Labels */
.ronda-label, .brand-side { background: #f2f2f2; width: 30px; text-align: center; }
.ronda-label div, .brand-side div { writing-mode: vertical-rl; transform: rotate(180deg); font-weight: bold; white-space: nowrap; padding: 10px 0; }
.brand-side { background: #002060; color: #fff; }

/* Headers */
.grid-header { background: #002060; color: #fff; padding: 5px; font-size: 14px; }
.rt-header { background: #002060; color: #fff; padding: 5px; font-size: 10px; }
.brand { float: right; font-size: 9px; }

/* Grid */
.grid-area { padding: 10px; vertical-align: top; }
.inner-grid { border-collapse: collapse; margin: 0 auto; }
.inner-grid td { border: 1px solid #000; width: 32px; height: 32px; text-align: center; vertical-align: middle; position: relative; }
.label-cell { background: #d9d9d9; font-weight: bold; font-size: 10px; width: 20px !important; height: 20px !important; }
.grid-cell { background: #fff; }
.seq { background: #fff; font-size: 16px; }
.obs { background: #ffc7ce; color: #9c0006; font-weight: bold; font-size: 14px; }
.bs { background: #ffffcc; }
.bs-star { color: #ff9900; position: absolute; top: 1px; right: 2px; font-size: 10px; }
.bs-dir { position: absolute; bottom: 1px; right: 2px; font-size: 8px; font-weight: bold; }
.legend { font-size: 9px; text-align: center; margin-top: 5px; color: #555; }

/* Route Area */
.route-area { vertical-align: top; width: 350px; }
.inner-route { width: 100%; border-collapse: collapse; height: 100%; }
.inner-route td { border: 1px solid #000; padding: 5px; vertical-align: middle; }
.rt-val { font-weight: bold; text-align: center; width: 60px; }
.rt-pond { text-align: center; width: 40px; }
.bonus-text { font-size: 9px; vertical-align: top; line-height: 1.3; text-align: justify; padding: 8px !important; }

/* Footer info */
.footer-row td { background: #f2f2f2; }
.val-esp { font-size: 10px; text-align: center; }
.bonus-val-cell { background: #002060 !important; color: #fff; text-align: center; padding: 5px !important; }
.bv-title { font-size: 8px; font-weight: bold; }
.bv-num { font-size: 20px; font-weight: bold; }
.important { padding: 8px !important; font-size: 9px; background: #f2f2f2; }

@media print {
    body { padding: 0; }
    .card { margin-bottom: 15px; }
}
</style>
</head>
<body>
"""

    numbers_circled = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"]

    for r in range(1, 6):
        r_str = str(r)
        if r_str not in tracks_data: continue
        html_content += f'<div class="section-title">Ronda {r_str}</div>\n'
        
        for p in range(1, 6):
            p_str = str(p)
            if p_str not in tracks_data[r_str]: continue
            track = tracks_data[r_str][p_str]
            sequence = track.get('sequence', [])
            obstacles = track.get('obstacles', [])
            bonusRules = track.get('bonusRules', '')
            bonusStart = track.get('bonusStart', '')
            bonusDir = track.get('bonusDir', '')
            bonusPoints = track.get('bonusPoints', 3) # Default 3

            html_content += f"""
<div class="card">
    <table class="main-table" cellspacing="0">
        <tr>
            <td class="ronda-label" rowspan="3"><div>Ronda {r_str} (G: __)</div></td>
            <th class="grid-header">Pista {p_str} <span class="brand">adakademy &#x29BE;</span></th>
            <th class="rt-header">Ruta</th>
            <th class="rt-header">Pond.</th>
            <th class="rt-header">Bonus</th>
            <td class="brand-side" rowspan="3"><div>adakademy &#x29BE;</div></td>
        </tr>
        <tr>
            <td class="grid-area">
                <table class="inner-grid" cellspacing="0">
"""
            # Build 6x10 grid (rows 6 down to 1)
            for row_num in range(6, 0, -1):
                html_content += f'                    <tr><td class="label-cell">{row_num}</td>'
                for col_num in range(10): # A to J
                    cell_col = chr(ord('A') + col_num)
                    cell_coord = f"{cell_col}{row_num}"
                    
                    cell_class = "grid-cell"
                    cell_content = ""
                    
                    # Is it in sequence?
                    seq_idx = -1
                    if cell_coord in sequence:
                        seq_idx = sequence.index(cell_coord)
                        cell_class += " seq"
                        cell_content = f"<b>{numbers_circled[seq_idx]}</b>"
                    
                    # Is it an obstacle?
                    if cell_coord in obstacles:
                        cell_class = "grid-cell obs"
                        cell_content = "✕"
                    
                    # Is it bonus start?
                    if cell_coord == bonusStart:
                        cell_class += " bs"
                        star = '<span class="bs-star">★</span>'
                        direction = f'<small class="bs-dir">{bonusDir}</small>'
                        cell_content += f"{star}{direction}"
                    
                    html_content += f'<td class="{cell_class}">{cell_content}</td>'
                html_content += '</tr>'

            # Bottom labels (A-J)
            html_content += '                    <tr><td class="label-cell"></td>'
            for col_num in range(10):
                html_content += f'<td class="label-cell">{chr(ord("A") + col_num)}</td>'
            html_content += '</tr>\n                </table>\n'
            html_content += '                <div class="legend">① Ruta | ✕ Obstáculo | ★ Bonus</div>\n            </td>\n'

            # Route Area
            html_content += '            <td class="route-area" colspan="3">\n                <table class="inner-route" cellspacing="0">\n'
            
            num_rows = len(sequence)
            for i, step in enumerate(sequence):
                bonus_td = ""
                if i == 0:
                    bonus_td = f'<td rowspan="{num_rows}" class="bonus-text">{bonusRules}</td>'
                
                html_content += f'                    <tr><td class="rt-val">{numbers_circled[i]} {step}</td><td class="rt-pond">1</td>{bonus_td}</tr>'

            html_content += f"""
                    <tr class="footer-row">
                        <td colspan="2" class="val-esp">Valor esperado: <b>{len(sequence)}</b></td>
                        <td class="bonus-val-cell">
                            <div class="bv-title">VALOR BONUS</div>
                            <div class="bv-num">{bonusPoints}</div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td colspan="4" class="important">
                <b>IMPORTANTE:</b> El robot debe seguir la ruta en orden del ① al {numbers_circled[len(sequence)-1]}. Cada cuadro mide 17x17cm. 
                {"Obstáculos: " + ", ".join(obstacles) if obstacles else ""}
            </td>
        </tr>
    </table>
</div>
"""

    html_content += "</body>\n</html>"

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"Successfully updated {output_file} supporting dynamic bonus points.")

if __name__ == "__main__":
    sync_tracks()
