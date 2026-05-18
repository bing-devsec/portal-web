import yaml from 'js-yaml';
import * as toml from '@iarna/toml';
import { create } from 'xmlbuilder2';

// JSON 转 YAML（使用 js-yaml 库）
export const convertToYAML = (obj: any): string => {
    try {
        return yaml.dump(obj, {
            indent: 2,
            lineWidth: -1, // 不换行
            quotingType: '"', // 使用双引号
            forceQuotes: false, // 非必要不添加引号
            skipInvalid: true, // 跳过无效值
            sortKeys: false, // 保持键的原始顺序
        } as yaml.DumpOptions);
    } catch (error) {
        throw new Error(`YAML 转换失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
};

// JSON 转 TOML（使用 @iarna/toml 库）
export const convertToTOML = (obj: any): string => {
    try {
        // TOML 只支持对象作为根类型，不支持数组作为根
        if (Array.isArray(obj)) {
            // 如果是数组，转换为 { items: array } 格式
            obj = { items: obj };
        }
        return toml.stringify(obj);
    } catch (error) {
        throw new Error(`TOML 转换失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
};

// JSON 转 XML（使用 xmlbuilder2 库）
export const convertToXML = (obj: any, rootName: string = 'root'): string => {
    try {
        // 验证XML标签名（只允许字母、数字、下划线、连字符）
        const sanitizeTagName = (name: string): string => {
            if (/^\d/.test(name)) {
                name = 'item' + name;
            }
            return name.replace(/[^a-zA-Z0-9_\-]/g, '_');
        };

        // 处理对象或数组转 XML 节点
        const processValue = (value: any, node: any, key: string): void => {
            const sanitizedKey = sanitizeTagName(key);

            if (value === null || value === undefined) {
                node.ele(sanitizedKey);
                return;
            }

            if (typeof value === 'boolean' || typeof value === 'number') {
                node.ele(sanitizedKey).txt(String(value));
                return;
            }

            if (typeof value === 'string') {
                node.ele(sanitizedKey).txt(value);
                return;
            }

            if (Array.isArray(value)) {
                if (value.length === 0) {
                    node.ele(sanitizedKey);
                    return;
                }
                const parentNode = node.ele(sanitizedKey);
                value.forEach((item) => {
                    processValue(item, parentNode, 'item');
                });
                return;
            }

            if (typeof value === 'object') {
                const parentNode = node.ele(sanitizedKey);
                for (const [childKey, childValue] of Object.entries(value)) {
                    processValue(childValue, parentNode, childKey);
                }
                return;
            }

            node.ele(sanitizedKey).txt(String(value));
        };

        // 创建 XML 文档
        const rootNode = create({ version: '1.0', encoding: 'UTF-8' }).ele(rootName);

        if (Array.isArray(obj)) {
            obj.forEach((item) => {
                processValue(item, rootNode, 'item');
            });
        } else if (typeof obj === 'object' && obj !== null) {
            for (const [key, value] of Object.entries(obj)) {
                processValue(value, rootNode, key);
            }
        } else {
            rootNode.txt(String(obj));
        }

        return rootNode.end({ prettyPrint: true, indent: '  ' });
    } catch (error) {
        throw new Error(`XML 转换失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
};

// JSON 转 Go 结构体（合并同名结构体样本，支持递归数组结构）
export const convertToGo = (obj: any): string => {
    let result = '';

    const commonInitialisms = new Map(
        [
            'ACL', 'API', 'ASCII', 'CPU', 'CSS', 'DNS', 'EOF', 'GUID',
            'HTML', 'HTTP', 'HTTPS', 'ID', 'IP', 'JSON', 'LHS', 'QPS',
            'RAM', 'RHS', 'RPC', 'SLA', 'SMTP', 'SQL', 'SSH', 'TCP',
            'TLS', 'TTL', 'UDP', 'UI', 'UID', 'UUID', 'URI', 'URL',
            'UTF8', 'VM', 'XML', 'XMPP', 'XSRF', 'XSS',
        ].map(item => [item.toLowerCase(), item] as const)
    );

    const splitGoNameParts = (str: string): string[] => {
        return str
            .replace(/[^a-zA-Z0-9]+/g, ' ')
            .split(/\s+/)
            .filter(Boolean)
            .flatMap(part => part.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g) || []);
    };

    const toGoExportedName = (str: string): string => {
        const parts = splitGoNameParts(str);
        if (parts.length === 0) {
            return 'Field';
        }

        const exportedName = parts
            .map(part => {
                const initialism = commonInitialisms.get(part.toLowerCase());
                if (initialism) {
                    return initialism;
                }
                return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
            })
            .join('');

        return /^\d/.test(exportedName) ? `Field${exportedName}` : exportedName;
    };

    // 生成结构体名称
    const getStructName = (key: string): string => {
        return toGoExportedName(key);
    };

    type FieldSamples = Map<string, any[]>;
    const structSchemas = new Map<string, FieldSamples>();
    const structOrder: string[] = [];

    const isPlainObject = (value: any): value is Record<string, any> => {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    };

    const ensureStructSchema = (structName: string): FieldSamples => {
        let schema = structSchemas.get(structName);
        if (!schema) {
            schema = new Map<string, any[]>();
            structSchemas.set(structName, schema);
            structOrder.push(structName);
        }
        return schema;
    };

    const collectArrayElementSchemas = (arrayValue: any[], key: string) => {
        const itemType = getStructName(key);
        for (const item of arrayValue) {
            if (isPlainObject(item)) {
                collectStructSchema(item, itemType);
            } else if (Array.isArray(item)) {
                collectArrayElementSchemas(item, key);
            }
        }
    };

    const collectStructSchema = (value: Record<string, any>, structName: string) => {
        const schema = ensureStructSchema(structName);

        for (const [key, fieldValue] of Object.entries(value)) {
            const samples = schema.get(key) || [];
            samples.push(fieldValue);
            schema.set(key, samples);

            if (Array.isArray(fieldValue)) {
                collectArrayElementSchemas(fieldValue, key);
            } else if (isPlainObject(fieldValue)) {
                collectStructSchema(fieldValue, getStructName(key));
            }
        }
    };

    const inferPrimitiveType = (values: any[]): string => {
        const nonNullValues = values.filter(value => value !== null && value !== undefined);
        if (nonNullValues.length === 0) return 'any';

        const hasString = nonNullValues.some(value => typeof value === 'string');
        const hasBool = nonNullValues.some(value => typeof value === 'boolean');
        const numbers = nonNullValues.filter(value => typeof value === 'number');
        const hasOther = nonNullValues.some(value => !['string', 'number', 'boolean'].includes(typeof value));

        if (hasOther) return 'any';
        if (hasString && !hasBool && numbers.length === 0) return 'string';
        if (hasBool && !hasString && numbers.length === 0) return 'bool';
        if (numbers.length === nonNullValues.length) {
            return numbers.every(Number.isInteger) ? 'int' : 'float64';
        }

        return 'any';
    };

    const inferArrayType = (arrays: any[][], key: string): string => {
        const elements = arrays.flat().filter(value => value !== null && value !== undefined);
        if (elements.length === 0) return '[]any';

        const objectElements = elements.filter(isPlainObject);
        if (objectElements.length > 0) {
            return `[]${getStructName(key)}`;
        }

        const nestedArrays = elements.filter(Array.isArray);
        if (nestedArrays.length > 0) {
            const nestedType = inferArrayType(nestedArrays, key);
            return `[]${nestedType}`;
        }

        return `[]${inferPrimitiveType(elements)}`;
    };

    const inferGoTypeFromSamples = (samples: any[], key: string): string => {
        const nonNullSamples = samples.filter(value => value !== null && value !== undefined);
        if (nonNullSamples.length === 0) return 'any';

        const arraySamples = nonNullSamples.filter(Array.isArray);
        if (arraySamples.length > 0) {
            return inferArrayType(arraySamples, key);
        }

        if (nonNullSamples.some(isPlainObject)) {
            return getStructName(key);
        }

        return inferPrimitiveType(nonNullSamples);
    };

    const buildStructDefinition = (structName: string, schema: FieldSamples): string => {
        const indent = '    ';
        let structDef = `type ${structName} struct {\n`;

        for (const [key, samples] of schema.entries()) {
            const fieldName = toGoExportedName(key);
            const goType = inferGoTypeFromSamples(samples, key);
            structDef += `${indent}${fieldName} ${goType} \`json:"${key}"\`\n`;
        }

        structDef += '}\n\n';
        return structDef;
    };

    const buildStructDefinitions = (): string => {
        return [...structOrder]
            .reverse()
            .map(structName => buildStructDefinition(structName, structSchemas.get(structName)!))
            .join('');
    };

    try {
        // 如果顶层是数组，使用 'Root' 作为最终类型名，'Item' 作为元素类型名
        if (Array.isArray(obj)) {
            if (obj.length > 0 && obj.some(isPlainObject)) {
                obj.forEach(item => {
                    if (isPlainObject(item)) {
                        collectStructSchema(item, 'Item');
                    }
                });
                result = buildStructDefinitions() + 'type Root []Item';
            } else {
                result = `type Root ${inferArrayType([obj], 'item')}`;
            }
        } else if (isPlainObject(obj)) {
            collectStructSchema(obj, 'Root');
            result = buildStructDefinitions();
        } else {
            result = `type Root ${inferPrimitiveType([obj])}`;
        }
        return result.trim();
    } catch (error: any) {
        throw new Error('转换 Go 结构体失败: ' + error.message);
    }
};

// Cookie 转 JSON
export const cookieToJSON = (cookieStr: string, indentSize: number = 2): string => {
    try {
        // 处理常见的 Cookie 格式问题
        const cookies = cookieStr
            .split(/[;\n]/) // 分割多个 cookie（支持分号或换行分隔）
            .map(pair => pair.trim())
            .filter(pair => pair) // 过滤空值
            .reduce((acc: Record<string, any>, pair) => {
                // 处理键值对
                const [key, ...values] = pair.split('=');
                const value = values.join('='); // 处理值中包含等号的情况

                if (key && value) {
                    try {
                        // 尝试解码 URI 编码的值
                        acc[key.trim()] = decodeURIComponent(value.trim());
                    } catch {
                        // 如果解码失败，使用原始值
                        acc[key.trim()] = value.trim();
                    }
                }
                return acc;
            }, {});

        return JSON.stringify(cookies, null, indentSize);
    } catch (error: any) {
        throw new Error('Cookie 格式无效: ' + error.message);
    }
};
