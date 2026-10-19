"""Produit une copie anonymisée d'un TSP pour les tests : noms de personnes et client remplacés,
macros retirées (.xlsm -> .xlsx). Les valeurs mémorisées des formules sont conservées (on touche au XML)."""
import sys, zipfile, re, json
# Usage : python3 anonymise.py <tsp réel> <copie anonymisée> <remplacements.json>
# remplacements.json : [["texte réel", "texte fictif"], …] (noms des personnes, du client, de l'agence).
# Ce fichier contient des données réelles : il reste sur votre poste et n'entre JAMAIS dans le dépôt
# (motif *.remplacements.json dans .gitignore).
src, dst, regles = sys.argv[1], sys.argv[2], sys.argv[3]
REMPL = [tuple(x) for x in json.load(open(regles, encoding='utf-8'))]
zin = zipfile.ZipFile(src)
zout = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
for it in zin.infolist():
    n = it.filename
    if n.endswith('vbaProject.bin') or n.endswith('vbaProjectSignature.bin'):
        continue
    data = zin.read(n)
    if n.endswith('.xml') or n.endswith('.rels'):
        s = data.decode('utf-8')
        for a, b in REMPL: s = s.replace(a, b)
        s = re.sub(r'<dc:creator>[^<]*', '<dc:creator>Auteur', s)
        s = re.sub(r'<cp:lastModifiedBy>[^<]*', '<cp:lastModifiedBy>Auteur', s)
        s = re.sub(r'displayName="[^"]*"', 'displayName="Auteur"', s)
        s = re.sub(r'userId="[^"]*"', 'userId="auteur"', s)
        s = re.sub(r'refreshedBy="[^"]*"', 'refreshedBy="Auteur"', s)
        s = re.sub(r'<x15ac:absPath[^>]*/>', '', s)  # chemin du fichier sur le poste de l'auteur
        if n.startswith('xl/externalLinks/_rels/'):
            s = re.sub(r'Target="https?://[^"]*"', 'Target="https://exemple.invalid/modele.xlsx"', s)  # intranet d'origine
        if n == '[Content_Types].xml':
            s = re.sub(r'<Override[^>]*vbaProject[^>]*/>', '', s)
            s = re.sub(r'<Default[^>]*Extension="bin"[^>]*/>', '', s)
            s = s.replace('application/vnd.ms-excel.sheet.macroEnabled.main+xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml')
        if n == 'xl/_rels/workbook.xml.rels':
            s = re.sub(r'<Relationship[^>]*vbaProject[^>]*/>', '', s)
        data = s.encode('utf-8')
    zout.writestr(it, data)
zout.close()
