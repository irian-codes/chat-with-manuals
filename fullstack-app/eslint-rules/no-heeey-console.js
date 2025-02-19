const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "Disallow console.(log|warn) statements that start with 'heeey'",
      recommended: false,
      url: 'https://eslint.org/docs/latest/extend/custom-rules',
    },
    fixable: 'code',
    schema: [],
    messages: {
      forbiddenConsole:
        "Console.(log|warn) statements starting with 'heeey' are not allowed.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        // Check if the callee is a MemberExpression like console.log
        if (
          node.callee &&
          node.callee.type === 'MemberExpression' &&
          node.callee.object &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'console' &&
          node.callee.property &&
          node.callee.property.type === 'Identifier' &&
          (node.callee.property.name === 'log' ||
            node.callee.property.name === 'warn')
        ) {
          // Ensure there is at least one argument to console.log
          const [firstArg] = node.arguments;
          if (
            firstArg &&
            firstArg.type === 'Literal' &&
            typeof firstArg.value === 'string' &&
            firstArg.value.startsWith('heeey')
          ) {
            context.report({
              node,
              messageId: 'forbiddenConsole',
              fix: (fixer) => {
                // Attempt to remove the entire statement if possible.
                if (node.parent && node.parent.type === 'ExpressionStatement') {
                  return fixer.remove(node.parent);
                }
                // Fallback: remove just the console.log call.
                return fixer.remove(node);
              },
            });
          }
        }
      },
    };
  },
};

export default rule;
