-- GharKharch: AI Subscription services (OpenAI ChatGPT, Anthropic Claude, Google Gemini, Cursor, etc.)
-- 1. Adds "AI & Software" subcategory under "Bills & Utilities"
-- 2. Seeds global system merchants for major AI platforms
-- 3. Maps them to Bills & Utilities -> AI & Software
-- 4. Removes "chatgpt" from OTT & Subscriptions rule
-- 5. Adds a dedicated "AI & Software Subscriptions" smart automation rule

-- =========================================================
-- 1. Add "AI & Software" Subcategory under "Bills & Utilities"
-- =========================================================
insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, 'AI & Software', 'cpu', 'indigo', 7
from categories p
where p.name = 'Bills & Utilities' and p.household_id is null and p.parent_id is null
  and not exists (
    select 1 from categories c
    where c.parent_id = p.id and lower(trim(c.name)) = 'ai & software' and c.household_id is null
  );

-- =========================================================
-- 2. Add System Merchants for AI Services
-- =========================================================
insert into merchants (household_id, name, normalized_name, merchant_type, channel, is_system, aliases) values
  (null, 'OpenAI (ChatGPT)',   'openaichatgpt',  'subscription', 'online', true, array['chatgpt', 'chat gpt', 'openai', 'gpt-4', 'chatgpt plus', 'chatgpt pro']),
  (null, 'Anthropic (Claude)', 'anthropicclaude','subscription', 'online', true, array['claude', 'claude ai', 'claude pro', 'anthropic']),
  (null, 'Google Gemini',      'googlegemini',   'subscription', 'online', true, array['gemini', 'gemini advanced', 'google one ai', 'google gemini']),
  (null, 'Cursor AI',          'cursorai',       'subscription', 'online', true, array['cursor', 'cursor ai', 'cursor pro', 'anysphere']),
  (null, 'Perplexity AI',      'perplexityai',   'subscription', 'online', true, array['perplexity', 'perplexity ai', 'perplexity pro']),
  (null, 'Midjourney',         'midjourney',     'subscription', 'online', true, array['midjourney', 'midjourney ai']),
  (null, 'GitHub Copilot',     'githubcopilot',  'subscription', 'online', true, array['github copilot', 'copilot'])
on conflict (normalized_name) where household_id is null do nothing;

-- =========================================================
-- 3. Link Merchants to Bills & Utilities -> AI & Software
-- =========================================================
update merchants m
set subcategory_id = c.id,
    category_id = p.id
from categories c
join categories p on p.id = c.parent_id
where m.household_id is null
  and m.normalized_name in (
    'openaichatgpt',
    'anthropicclaude',
    'googlegemini',
    'cursorai',
    'perplexityai',
    'midjourney',
    'githubcopilot'
  )
  and p.name = 'Bills & Utilities'
  and p.household_id is null
  and c.name = 'AI & Software';

-- =========================================================
-- 4. Clean up ChatGPT from OTT & Subscriptions rule
-- =========================================================
update automation_rules
set conditions = jsonb_set(
  conditions,
  '{keywords}',
  '["netflix", "prime video", "hotstar", "spotify", "youtube premium", "icloud"]'::jsonb
)
where name = 'OTT & Subscriptions';

-- =========================================================
-- 5. Add Dedicated Smart Rule for AI Subscriptions
-- =========================================================
insert into automation_rules (household_id, name, priority, conditions, actions)
select
  null,
  'AI & Software Subscriptions',
  110,
  '{"keywords": ["chatgpt", "openai", "claude", "anthropic", "gemini", "cursor", "perplexity", "midjourney", "copilot"], "entry_type": "expense"}'::jsonb,
  '{"category_name": "Bills & Utilities", "subcategory_name": "AI & Software", "payment_method": "Card"}'::jsonb
where not exists (
  select 1 from automation_rules where name = 'AI & Software Subscriptions' and household_id is null
);
