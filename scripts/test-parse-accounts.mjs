import { parseMultipleAccounts, parseAccountInput, MAX_ACCOUNTS } from '../dist/services/account-viewer.js';

console.log(`MAX_ACCOUNTS = ${MAX_ACCOUNTS}`);
if (MAX_ACCOUNTS !== 8) {
  console.error(`Expected MAX_ACCOUNTS to be 8, got ${MAX_ACCOUNTS}`);
  process.exit(1);
}

function show(label, input) {
  const { valid, invalid } = parseMultipleAccounts(input);
  console.log(`\n=== ${label} ===`);
  console.log(`input: ${JSON.stringify(input)}`);
  console.log(`valid (${valid.length}):`, valid.map(v => `${v.platform}:${v.username}`));
  console.log(`invalid (${invalid.length}):`, invalid);
}

// 1. Single account (backward compat)
show('single @username', '@coinbase');

// 2. Multiple accounts separated by comma
show('comma separated', '@user1, @user2, @user3');

// 3. Multiple accounts separated by space
show('space separated', '@user1 @user2 @user3');

// 4. Mixed comma + space
show('mixed comma+space', '@a, @b @c, @d');

// 5. URLs separated by space (should keep URLs intact)
show('urls space separated', 'https://www.tiktok.com/@coinbase https://www.instagram.com/coinbase/');

// 6. URLs separated by comma
show('urls comma separated', 'https://www.youtube.com/@MrBeast, https://www.tiktok.com/@durov');

// 7. Mixed bare + URL
show('mixed bare+url', '@a, https://www.tiktok.com/@b, https://www.youtube.com/@c');

// 8. Duplicates should be removed
show('duplicates', '@a, @a, tiktok.com/@a');

// 9. Some invalid tokens
show('with invalid', '@good1, $$$invalid, @good2');

// 10. Exceeding limit (>8)
show('over limit', '@a @b @c @d @e @f @g @h @i @j @k @l');

console.log('\nAll parse tests completed.');