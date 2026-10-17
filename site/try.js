// The "Try it" window on the website (docs/index.html, #try): Edith's editor (Toast UI in Write mode) on the left,
// the Markdown it saves on the right. Bundled by scripts/site.sh into _site/assets/try.js (+ try.css) and loaded by
// the page when the window comes near the screen. No files, no storage, no network: the text lives in the page.
import Editor from '@toast-ui/editor';
import '@toast-ui/editor/dist/toastui-editor.css';

// Edith's own clean-up on save (normalizeMd in app.js): "-" bullets, "---" rules, no stray trailing spaces
function normalizeMd(md) {
  const lines = md.split('\n');
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) {
      fence = !fence;
      continue;
    }
    if (!fence)
      lines[i] = lines[i]
        .replace(/^(\s*)\* /, '$1- ')
        .replace(/^\s*(\*\s*){3,}$/, '---')
        .replace(/[ \t]+$/, (m) => (m.length >= 2 ? '  ' : ''));
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
}

// a little colour in the Markdown pane, so the syntax Edith writes stands out from the words
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function highlight(md) {
  let fence = false;
  return md
    .split('\n')
    .map((raw) => {
      if (/^\s*```/.test(raw)) {
        fence = !fence;
        return '<span class="m">' + esc(raw) + '</span>';
      }
      if (fence) return '<span class="c">' + esc(raw) + '</span>';
      let l = esc(raw);
      if (/^#{1,6} /.test(raw)) return l.replace(/^(#{1,6} )(.*)$/, '<span class="m">$1</span><b>$2</b>');
      l = l
        .replace(/^(\s*)(&gt; ?)/, '$1<span class="m">$2</span>')
        .replace(/^(\s*)([-*+] \[[ xX]\] |[-*+] |\d+\. )/, '$1<span class="m">$2</span>')
        .replace(/^(---)$/, '<span class="m">$1</span>')
        .replace(/(`[^`]+`)/g, '<span class="c">$1</span>')
        .replace(/(\*\*|__)(?=\S)(.+?)(\1)/g, '<span class="m">$1</span><b>$2</b><span class="m">$3</span>')
        .replace(/(^|[^*\w])(\*|_)(?=\S)([^*_]+?)(\2)(?![*\w])/g, '$1<span class="m">$2</span><i>$3</i><span class="m">$4</span>')
        .replace(/(~~)(.+?)(~~)/g, '<span class="m">$1</span><s>$2</s><span class="m">$3</span>')
        .replace(/\[([^\]]*)\]\(([^)\s]*)\)/g, '<span class="m">[</span>$1<span class="m">](</span><span class="u">$2</span><span class="m">)</span>');
      return l;
    })
    .join('\n');
}

window.edithTry = function (root) {
  const docEl = root.querySelector('.try-edit'),
    mdEl = root.querySelector('.try-md pre');
  const sample = mdEl.textContent;
  docEl.innerHTML = '';
  const editor = new Editor({
    el: docEl,
    height: 'auto',
    initialEditType: 'wysiwyg',
    initialValue: sample,
    hideModeSwitch: true,
    toolbarItems: [],
    usageStatistics: false,
    autofocus: false,
    linkAttributes: { target: '_blank', rel: 'noopener' },
  });
  const view = editor.wwEditor.view;
  let queued = false;
  const render = () => {
    queued = false;
    mdEl.innerHTML = highlight(normalizeMd(editor.getMarkdown()));
  };
  editor.on('change', () => {
    if (!queued) (queued = true), requestAnimationFrame(render);
  });
  render();

  // Edith's typing shortcuts: "# " heading, "- " bullet, "1. " numbers, "[ ] " checklist, "> " quote, "---" divider
  view.setProps({
    handleTextInput(v, from, to, text) {
      if (text !== ' ' && text !== '-') return false;
      const $from = v.state.selection.$from;
      if ($from.parent.type.name !== 'paragraph' || $from.depth !== 1) return false;
      const before = $from.parent.textBetween(0, $from.parentOffset, '', '');
      let cmd = null,
        payload,
        m;
      if (text === ' ') {
        if ((m = before.match(/^(#{1,6})$/))) (cmd = 'heading'), (payload = { level: m[1].length });
        else if (/^[-*+]$/.test(before)) cmd = 'bulletList';
        else if (/^\d{1,3}\.$/.test(before)) cmd = 'orderedList';
        else if (/^\[( |x|X)?\]$/.test(before)) cmd = 'taskList';
        else if (before === '>') cmd = 'blockQuote';
      } else if (before === '--' && $from.parentOffset === $from.parent.content.size) cmd = 'hr';
      if (!cmd) return false;
      v.dispatch(v.state.tr.delete($from.start(), $from.pos));
      run(cmd, payload);
      return true;
    },
  });

  function run(cmd, payload) {
    if (cmd === 'taskList') {
      // like Edith: a checklist from a plain paragraph needs a list first
      const $from = view.state.selection.$from;
      let inList = false;
      for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'listItem') inList = true;
      if (!inList) editor.exec('bulletList');
    }
    if (cmd === 'paragraph') {
      const { state, dispatch } = view;
      dispatch(state.tr.setBlockType(state.selection.from, state.selection.to, state.schema.nodes.paragraph));
    } else editor.exec(cmd, payload);
  }

  // toolbar
  const bar = root.querySelector('.try-bar'),
    styleSel = bar.querySelector('select');
  bar.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) e.preventDefault(); // keep the selection in the document
  });
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cmd]');
    if (!b) return;
    if (b.dataset.cmd === 'link') return openLink();
    run(b.dataset.cmd);
    editor.focus();
  });
  styleSel.addEventListener('change', () => {
    const level = +styleSel.value;
    if (level) run('heading', { level });
    else run('paragraph');
    editor.focus();
  });

  // which buttons apply where the caret is
  const marks = { bold: 'strong', italic: 'emph', strike: 'strike', code: 'code' };
  const blocks = { bulletList: 'bulletList', orderedList: 'orderedList', blockQuote: 'blockQuote' };
  function sync() {
    const st = view.state,
      $from = st.selection.$from;
    const active = new Set(),
      { from, to, empty } = st.selection,
      onMarks = st.storedMarks || $from.marks();
    for (const [cmd, name] of Object.entries(marks)) {
      const type = st.schema.marks[name];
      if (type && (empty ? onMarks.some((mk) => mk.type === type) : st.doc.rangeHasMark(from, to, type))) active.add(cmd);
    }
    let heading = 0;
    for (let d = $from.depth; d > 0; d--) {
      const n = $from.node(d);
      for (const [cmd, name] of Object.entries(blocks)) if (n.type.name === name) active.add(cmd);
      if (n.type.name === 'listItem' && n.attrs.task) active.add('taskList');
      if (n.type.name === 'heading') heading = n.attrs.level;
    }
    if (active.has('taskList')) active.delete('bulletList');
    bar.querySelectorAll('button[data-cmd]').forEach((b) => b.setAttribute('aria-pressed', active.has(b.dataset.cmd)));
    styleSel.value = String(Math.min(heading, 3));
  }
  const origDispatch = view.props.dispatchTransaction;
  view.setProps({
    dispatchTransaction(tr) {
      origDispatch.call(this, tr);
      sync();
    },
  });
  view.dom.addEventListener('focus', sync);
  sync();

  // link: a small field under the toolbar instead of a dialog
  const linkBox = root.querySelector('.try-link'),
    linkIn = linkBox.querySelector('input');
  function openLink() {
    linkBox.hidden = false;
    linkIn.value = '';
    linkIn.focus();
  }
  linkBox.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = linkIn.value.trim();
    linkBox.hidden = true;
    editor.focus();
    if (!url) return;
    const href = /^[a-z][\w+.-]*:/i.test(url) ? url : 'https://' + url;
    if (!/^(https?|mailto):/i.test(href)) return;
    const { from, to } = view.state.selection;
    const text = from === to ? url : view.state.doc.textBetween(from, to, ' ');
    editor.exec('addLink', { linkUrl: href, linkText: text });
  });
  linkIn.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') (linkBox.hidden = true), editor.focus();
  });

  root.querySelector('.try-reset').addEventListener('click', () => {
    editor.setMarkdown(sample, false);
    linkBox.hidden = true;
  });
  root.classList.add('live');
  return editor;
};
