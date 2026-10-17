// Neutral filler Markdown for size and timing tests (headings, paragraphs, lists, tables, code, links), generated
// deterministically so a test never needs a large fixture or a real document. filler(14000) has about 14,000 words as Edith counts them.
const WORDS = 'alpha beta gamma delta river stone maple cedar harbor lantern meadow orbit pencil quartz ribbon signal timber velvet window yellow amber copper drift ember falcon garden hollow island juniper kettle ledger marble north ocean pebble quiet relay summit thistle umber valley willow'.split(' ');
export function filler(target) {
  let seed = 7, n = 0, sec = 0;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const words = (k) => { const w = []; for (let i = 0; i < k; i++) w.push(WORDS[Math.floor(rnd() * WORDS.length)]); return w.join(' '); };
  const sentence = () => { const s = words(8 + Math.floor(rnd() * 10)); return s[0].toUpperCase() + s.slice(1) + '.'; };
  const out = ['# Sample document', ''];
  const push = out.push.bind(out);
  out.push = (...lines) => { for (const l of lines) n += (l.match(/\S+/g) || []).length; return push(...lines); };
  while (n < target) {
    sec++;
    out.push('## Section ' + sec + ' ' + words(2), '');
    out.push(sentence() + ' ' + sentence() + ' See [the ' + words(1) + ' page](https://example.com/' + sec + ') for **more** and *less*.', '');
    out.push(sentence() + ' ' + sentence() + ' ' + sentence(), '');
    if (sec % 2) { for (let i = 0; i < 4; i++) out.push('- ' + words(6)); out.push(''); }
    else { for (let i = 1; i <= 3; i++) out.push(i + '. ' + words(7)); out.push(''); }
    if (sec % 5 === 0) out.push('| Name | Value | Note |', '| --- | --- | --- |', '| ' + words(1) + ' | ' + sec + ' | ' + words(3) + ' |', '| ' + words(1) + ' | ' + (sec * 2) + ' | ' + words(3) + ' |', '');
    if (sec % 7 === 0) out.push('```js', 'const ' + WORDS[sec % WORDS.length] + ' = ' + sec + ';', 'console.log(' + WORDS[sec % WORDS.length] + ');', '```', '');
    if (sec % 4 === 0) out.push('### Detail ' + sec, '', '> ' + sentence(), '', '- [ ] ' + words(4), '- [x] ' + words(4), '');
  }
  return out.join('\n') + '\n';
}
