import reactHooks from '/app/frontend/node_modules/react-scripts/node_modules/eslint-plugin-react-hooks/index.js';
import babelParser from '/app/frontend/node_modules/react-scripts/node_modules/@babel/eslint-parser/lib/index.cjs';
export default [{
  files: ['**/*.js'],
  languageOptions: { parser: babelParser, parserOptions: { requireConfigFile: false, babelOptions: { presets: ['/app/frontend/node_modules/@babel/preset-react'] }, ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } } },
  plugins: { 'react-hooks': reactHooks },
  rules: { 'react-hooks/exhaustive-deps': 'warn', 'react-hooks/rules-of-hooks': 'error' },
}];
