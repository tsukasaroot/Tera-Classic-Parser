function loadProtocol(protocol, definitions) {
    Object.keys(protocol).forEach((keyWithVersion) => {
        const base64 = protocol[keyWithVersion];
        const defText = Buffer.from(base64, 'base64').toString('utf8');

        const regex = /\.([0-9]+)\.def/g;
        const key = keyWithVersion.replace(regex, '');

        const lines = defText
            .split('\n')
            .filter(line => line && !line.startsWith('#'))
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

            const fieldType = parts[0];
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
                // Add implicit ref field before array
                definitions[key].splice(definitions[key].length - 1, 0, {
                    name: `${fieldName}_ref`,
                    type: 'ref',
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