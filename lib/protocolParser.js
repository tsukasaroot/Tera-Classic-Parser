function loadProtocol(protocol, definitions) {
    const versionedDefs = {};
    Object.keys(protocol).forEach((keyWithVersion) => {
        const base64 = protocol[keyWithVersion];
        const regex = /\.([0-9]+)\.def$/;
        const match = keyWithVersion.match(regex);
        const version = match ? parseInt(match[1]) : 0;
        const key = keyWithVersion.replace(regex, '');

        if (!versionedDefs[key]) versionedDefs[key] = [];
        versionedDefs[key].push({ version, base64, keyWithVersion });
    });

    Object.keys(versionedDefs).forEach((key) => {
        const defs = versionedDefs[key];
        const latest = defs.sort((a, b) => b.version - a.version)[0];
        const base64 = latest.base64;
        const defText = Buffer.from(base64, 'base64').toString('utf8');

        const lines = defText
            .split('\n')
            .filter(line => line && !line.trim().startsWith('#')) // Filter all # lines
            .map(line => line.trim());

        if (!definitions[key]) definitions[key] = [];

        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            if (!line) {
                i++;
                continue;
            }

            const parts = line.split(/\s+/);
            if (parts.length < 2) {
                i++;
                continue;
            }

            let fieldType = parts[0];
            const fieldName = parts[1];

            if (fieldType === '-') {
                i++;
                continue;
            }

            if (fieldType === 'array') {
                definitions[key].push({ name: fieldName, type: fieldType, subType: [] });

                i++;
                while (i < lines.length && lines[i].startsWith('-')) {
                    const subLine = lines[i].trim();
                    const subParts = subLine.split(/\s+/);
                    if (subParts.length >= 3) {
                        const subFieldType = subParts[1];
                        const subFieldName = subParts[2];
                        definitions[key][definitions[key].length - 1].subType.push({
                            name: subFieldName,
                            type: subFieldType
                        });
                    }
                    i++;
                }
                i--;
                definitions[key].splice(definitions[key].length - 1, 0, {
                    name: `${fieldName}_ref`,
                    type: 'ref',
                    refField: fieldName
                });
            } else if (fieldType === 'offset') {
                definitions[key].push({
                    name: `offset_${fieldName}`,
                    type: 'offset',
                    refField: fieldName
                });
            } else {
                definitions[key].push({ name: fieldName, type: fieldType });
            }
            i++;
        }
    });
}

module.exports = loadProtocol;