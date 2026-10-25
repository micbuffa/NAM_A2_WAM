#!/usr/bin/env python3
"""Render the exported browser report; never infer missing timings or hardware."""
import argparse, html, json
from pathlib import Path


def rows(report):
    result = []
    for run in report['runs']:
        label = run['backend'] + (' / ' + run['deviceType'] + ' demandé' if run.get('deviceType') else '')
        summary = run.get('summary', {}) if run.get('status') == 'ok' else {}
        def seconds(value):
            return '—' if value is None else f'{value/1000:.3f}'
        result.append([
            'Demucs 4' if run['model'] == 'demucs4' else 'BS Roformer SW 6',
            run.get('runtimeVersion', run['runtime']), label,
            seconds(run.get('sessionMs')), seconds(summary.get('firstMs')),
            seconds(summary.get('warmMedianMs')),
            '—' if not summary else f"{summary['warmRtf']:.3f}",
            run.get('error', {}).get('message', run['status']),
        ])
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('report', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    report = json.loads(args.report.read_text())
    headings = ['Modèle', 'ORT', 'Backend', 'Session (s)', 'Première (s)', 'Répétitions médiane (s)', 'RTF', 'État']
    values = rows(report)
    table = '<thead><tr>' + ''.join('<th>'+html.escape(h)+'</th>' for h in headings) + '</tr></thead><tbody>'
    for row in values:
        table += '<tr>' + ''.join('<td>'+html.escape(v)+'</td>' for v in row) + '</tr>'
    table += '</tbody>'
    args.output.write_text('''<!doctype html><html lang="fr"><meta charset="utf-8"><title>Résultats WebNN / WebGPU / CPU</title><style>body{font:15px system-ui;color:#e7e9ef;background:#171b20;margin:24px auto;max-width:1280px}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border:1px solid #414955;padding:9px;text-align:left}th{background:#26322d}h1{font-size:26px}p{line-height:1.5}td:last-child{max-width:270px;overflow-wrap:anywhere;font-size:12px}</style><h1>Six secondes d’audio · WebNN / WebGPU / CPU</h1><p>Canary158 · Falcon stéréo44100Hz · une session par configuration · première exécution puis deux répétitions. RTF &lt; 1 : calcul plus rapide que la durée audio.</p><table>'''+table+'''</table><p>CPU/GPU/NPU WebNN : préférences demandées, processeur physique non vérifiable. SW GPU utilise les neuf étapes coopératives, les autres modes le graphe monolithique. Session = contexte + compilation, hors téléchargement. Les caches système ne sont pas purgés.</p><p>Une seule machine, ordre fixe, deux répétitions : résultats exploratoires sans classement perceptuel ni intervalle de confiance. Aucun changement du backend du host.</p><p><a style="color:#bde28a" href="'''+html.escape(args.report.name)+'''">Rapport JSON brut</a> · protocole et interprétation : MODEL_EVALUATIONS.MD §23.</p></html>''')
    print('| ' + ' | '.join(headings) + ' |')
    print('| ' + ' | '.join(['---']*len(headings)) + ' |')
    for row in values:
        print('| ' + ' | '.join(v.replace('|', '/') for v in row) + ' |')


if __name__ == '__main__':
    main()
