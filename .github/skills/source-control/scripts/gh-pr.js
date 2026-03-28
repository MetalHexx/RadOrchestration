'use strict';

const result = {
  pr_created: false,
  error: 'pr_mode_not_implemented',
  message: 'AUTO-PR not yet delivered'
};

console.log(JSON.stringify(result));
process.exit(2);
