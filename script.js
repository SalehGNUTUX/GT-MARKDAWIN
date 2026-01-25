/* script.js — الإصدار النهائي مع إصلاح تصدير PDF وإدارة Emoji */

/* DOM helpers */
const $ = sel => document.querySelector(sel);
const $all = sel => Array.from(document.querySelectorAll(sel));

/* notifier */
const notifier = {
  show(msg, type='info', time=2200){
    const existing = document.querySelector('.gt-notification'); 
    if(existing) existing.remove();
    const n = document.createElement('div'); 
    n.className='gt-notification'; 
    n.dataset.type=type; 
    n.textContent=msg; 
    document.body.appendChild(n);
    setTimeout(()=>n.classList.add('visible'),20); 
    setTimeout(()=>{ 
      n.classList.remove('visible'); 
      setTimeout(()=>n.remove(),300); 
    }, time);
  }
};

/* marked default options */
if(typeof marked !== 'undefined') marked.setOptions({ 
  gfm:true, 
  tables:true, 
  breaks:true, 
  headerIds:true, 
  mangle:false, 
  smartLists:true 
});

/* FontManager */
const FONT_EXTENSIONS = ['.woff2','.woff','.ttf','.otf'];
class FontManager {
  constructor(selectEl, importBtn){
    this.selectEl = selectEl; 
    this.importBtn = importBtn; 
    this.loaded = new Map(); 
    this.init();
  }
  
  init(){
    if(this.importBtn && window.showDirectoryPicker) {
      this.importBtn.addEventListener('click', ()=>this.pickDirectory());
    }
    else if(this.importBtn) {
      this.importBtn.addEventListener('click', ()=>notifier.show('متصفحك لا يدعم File System Access. استخدم fonts.json','info',3500));
    }
    
    this.scanFonts(); 
    this.timer = setInterval(()=>this.scanFonts(),15000);
    
    if(this.selectEl){
      this.selectEl.addEventListener('change', ()=>{
        const v = this.selectEl.value;
        if(v==='__system__') {
          document.documentElement.style.removeProperty('--app-font');
        }
        else {
          document.documentElement.style.setProperty('--app-font', `"${v}", system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial`);
        }
        localStorage.setItem('gt-markdawin-font', v);
      });
      
      const saved = localStorage.getItem('gt-markdawin-font');
      if(saved) {
        setTimeout(()=>{ 
          if([...this.selectEl.options].some(o=>o.value===saved)) { 
            this.selectEl.value=saved; 
            this.selectEl.dispatchEvent(new Event('change')); 
          } 
        }, 800);
      }
    }
  }
  
  async pickDirectory(){ 
    try{ 
      const dirHandle = await window.showDirectoryPicker(); 
      const fonts=[];
      for await(const entry of dirHandle.values()){ 
        if(entry.kind==='file' && FONT_EXTENSIONS.some(ext=>entry.name.toLowerCase().endsWith(ext))){ 
          const file = await entry.getFile(); 
          const url = URL.createObjectURL(file); 
          fonts.push({name:this.nameFrom(entry.name), url}); 
        } 
      } 
      if(fonts.length) this.applyFonts(fonts); 
      else notifier.show('لم يتم العثور على خطوط','info');
    }catch(e){ 
      console.warn(e); 
      notifier.show('تم إلغاء الوصول للمجلد','error',2000); 
    } 
  }
  
  async scanFonts(){ 
    try{ 
      const r = await fetch('fonts.json', {cache:'no-cache'}); 
      if(r.ok){ 
        const list = await r.json(); 
        if(Array.isArray(list) && list.length){ 
          const fonts = list.map(f=>({name:this.nameFrom(f), url:`fonts/${f}`})); 
          this.applyFonts(fonts); 
          return; 
        } 
      } 
    }catch(e){ 
      console.warn("fonts.json not available", e); 
    } 
    
    const common = [
      'Samim','Dubai-Regular','Dubai-Medium','Dubai-Light',
      'Dubai-Bold','Consolas-Regular','UthmanicHafs1 Ver13',
      'ArbFONTS-Amiri-Quran','amiri-quran','Ubuntu Arabic Regular',
      'Ubuntu Arabic Bold','(A) Arslan Wessam A'
    ]; 
    
    const candidates=[];
    for(const base of common){ 
      for(const ext of FONT_EXTENSIONS){ 
        const url = `fonts/${base}${ext}`; 
        try{ 
          const h = await fetch(url, {method:'HEAD'}); 
          if(h.ok){ 
            candidates.push({name:this.nameFrom(base+ext), url}); 
            break; 
          } 
        }catch(e){} 
      } 
    } 
    if(candidates.length) this.applyFonts(candidates); 
  }
  
  nameFrom(filename){ 
    const n = filename.split('/').pop().replace(/\.[^.]+$/,''); 
    return n.replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim(); 
  }
  
  applyFonts(list){ 
    let added=0; 
    const styleId='gt-dynamic-fonts'; 
    let style=document.getElementById(styleId); 
    if(!style){ 
      style=document.createElement('style'); 
      style.id=styleId; 
      document.head.appendChild(style); 
    } 
    
    list.forEach(item=>{ 
      if(this.loaded.has(item.name)) return; 
      const ext = item.url.split('.').pop().toLowerCase(); 
      const fmt = ext==='woff2'?'woff2':(ext==='woff'?'woff':(ext==='ttf'?'truetype':'opentype')); 
      const rule = `@font-face{ font-family: "${item.name}"; src: url("${item.url}") format("${fmt}"); font-display: swap; }`; 
      style.appendChild(document.createTextNode(rule)); 
      this.loaded.set(item.name,item.url); 
      
      if(this.selectEl && ![...this.selectEl.options].some(o=>o.value===item.name)){ 
        const o=document.createElement('option'); 
        o.value=item.name; 
        o.textContent=item.name; 
        this.selectEl.appendChild(o); 
      } 
      added++; 
    }); 
    
    if(added) notifier.show(`تم إضافة ${added} خطًا جديدًا`, 'success', 2600); 
    
    if(this.selectEl && ![...this.selectEl.options].some(o=>o.value==='__system__')){ 
      const o=document.createElement('option'); 
      o.value='__system__'; 
      o.textContent='افتراضي النظام'; 
      this.selectEl.prepend(o); 
    } 
  }
}

/* EmojiManager */
class EmojiManager {
  constructor(panelEl, toggleBtn){
    this.panel = panelEl; 
    this.toggleBtn = toggleBtn; 
    this.emojis = []; 
    this.lastKey = ''; 
    this.init();
  }
  
  init(){
    if(!this.panel || !this.toggleBtn) return;
    
    this.toggleBtn.addEventListener('click', e=>{ 
      e.stopPropagation(); 
      this.panel.classList.toggle('hidden'); 
      const rect = this.toggleBtn.getBoundingClientRect(); 
      this.panel.style.position='fixed'; 
      const top = rect.bottom + window.scrollY + 8; 
      let left = rect.left + window.scrollX; 
      if((left + this.panel.offsetWidth) > window.innerWidth) {
        left = Math.max(8, window.innerWidth - this.panel.offsetWidth - 8); 
      }
      this.panel.style.top = `${top}px`; 
      this.panel.style.left = `${left}px`; 
      this.panel.style.zIndex = '9999';
    });
    
    document.addEventListener('click', e=>{ 
      if(!this.panel.classList.contains('hidden') && 
         !this.panel.contains(e.target) && 
         e.target !== this.toggleBtn) {
        this.panel.classList.add('hidden'); 
      } 
    });
    
    this.loadStaticEmojis();
  }
  
  loadStaticEmojis(){
    const staticEmojis = [
      '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇',
      '🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚',
      '😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩',
      '🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣',
      '😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬',
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
      '❣️','💕','💞','💓','💗','💖','💘','💝','💟',
      '👋','🤚','🖐️','✋','🖖','👌','🤏','✌️','🤞','🤟',
      '🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎',
      '✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏',
      '⭐','🌟','✨','⚡','💥','🔥','💧','💦','☀️','🌙',
      '🌈','🌊','🎉','🎊','🎁','🎈','🎀','🎄','🎃','🎂',
      '🍎','🍕','🍦','☕','🎵','🎸','⚽','🎮','📱','💻',
      '📚','✏️','📎','🔗','💡','🔑','💰','💎','🎯','🏆',
      '✅','✔️','❌','❎','➡️','⬅️','⬆️','⬇️','↗️','↘️',
      '↙️','↖️','↔️','↩️','↪️','⤴️','⤵️','🔃','🔄','🔙',
      '🔚','🔛','🔜','🔝','🔀','🔁','🔂','▶️','⏩','⏪',
      '⏫','⏬','⏸️','⏹️','⏺️','🔅','🔆','📶','🔰','♻️',
      '☪️','🕋','🕌','🕍','📿','🕯️','📖','✒️','🖥️','⌨️',
      '🖱️','🖨️','💾','💿','📀','📡','🛰️','🔌','🔋','⚙️',
      '🛠️','🛡️','🔒','🔓','🤖','🧠','🦾','📊','📈','📉',
      '📁','📂','🔍','🛸','👾','🕹️','🐪','🌴','🌯','🥙',
      '🥘','🍲','🥗','🍯','🫖','👳','🧕','🏰','🏜️','🧿',
      '🪔','🏙️','🌃','🏺','🫠','🫢','🫣','🫡','🫥','🫤',
      '🥹','🚀'
    ];
    
    this.apply(staticEmojis);
  }
  
  apply(emojisList){
    const key = emojisList.join('|');
    if(key === this.lastKey) return;
    
    this.lastKey = key; 
    this.emojis = emojisList;
    this.panel.innerHTML = '';
    
    const grid = document.createElement('div'); 
    grid.className = 'emoji-grid';
    grid.style.display='grid'; 
    grid.style.gridTemplateColumns='repeat(auto-fill, minmax(40px, 1fr))'; 
    grid.style.gap='6px';
    grid.style.padding='12px';
    grid.style.maxHeight='300px';
    grid.style.overflowY='auto';
    
    emojisList.forEach(emoji=>{
      const btn = document.createElement('button'); 
      btn.type='button'; 
      btn.className='emoji-item'; 
      btn.textContent=emoji; 
      btn.title=emoji;
      btn.style.cssText = `
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 1.5rem;
        padding: 6px;
        border-radius: 6px;
        transition: all 0.2s;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      
      btn.addEventListener('mouseenter', () => {
        btn.style.background='rgba(56, 163, 255, 0.2)';
        btn.style.transform='scale(1.1)';
      });
      
      btn.addEventListener('mouseleave', () => {
        btn.style.background='transparent';
        btn.style.transform='scale(1)';
      });
      
      btn.addEventListener('click', ()=>{
        insertAtCursor(` ${emoji} `); 
        notifier.show('تم إدراج رمز تعبيري','success',700); 
        this.panel.classList.add('hidden'); 
      });
      
      grid.appendChild(btn);
    });
    
    this.panel.appendChild(grid);
  }
}

/* insertAtCursor */
function insertAtCursor(text){
  const ta = $('#editor'); 
  if(!ta) return; 
  const start = ta.selectionStart || 0; 
  const end = ta.selectionEnd || 0; 
  ta.setRangeText(text, start, end, 'end'); 
  ta.focus(); 
  ta.dispatchEvent(new Event('input',{bubbles:true}));
}

/* GTMarkdaWin application */
class GTMarkdaWin {
  constructor(){
    this.editor = $('#editor'); 
    this.preview = $('#preview'); 
    this.fontSelector = $('#fontSelector'); 
    this.importFontsBtn = $('#importFontsBtn');
    this.emojiPanel = $('#emojiPanel'); 
    this.emojiHeaderBtn = $('#emojiBtnHeader');
    this.isPreviewVisible = true; 
    this.theme='dark';
    this.isEditorSyncing=false; 
    this.isPreviewSyncing=false;
    this.init();
  }

  init(){
    if(typeof marked==='undefined'){ 
      setTimeout(()=>{ 
        if(typeof marked==='undefined') {
          notifier.show('مكتبة marked غير محملة','error'); 
        } else {
          this.afterMarked(); 
        }
      },300); 
      return; 
    }
    this.afterMarked();
  }

  afterMarked(){
    this.bindUI();
    this.fontManager = this.fontSelector ? new FontManager(this.fontSelector, this.importFontsBtn) : null;
    if(this.emojiPanel && this.emojiHeaderBtn) this.emojiManager = new EmojiManager(this.emojiPanel, this.emojiHeaderBtn);
    this.loadSaved();
    this.updatePreview = this._debounce(()=>this._updatePreview(), 180);
    this.saveToStorage = this._debounce(()=>this._saveToStorage(), 300);
    this._updatePreview();
    this.updateStats();
    notifier.show('GT-MARKDAWIN جاهز 🎉','success',900);
  }

  bindUI(){
    $all('.toolbar-btn').forEach(btn=>btn.addEventListener('click', ()=>this.executeCommand(btn.dataset.cmd)));
    
    if(this.editor){
      this.editor.addEventListener('input', ()=>{ 
        this.updatePreview(); 
        this.saveToStorage(); 
        this.updateStats(); 
      });
      
      this.editor.addEventListener('keydown', (e)=>{
        if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='b'){ 
          e.preventDefault(); 
          this.executeCommand('bold'); 
        } 
        if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='i'){ 
          e.preventDefault(); 
          this.executeCommand('italic'); 
        } 
        if(e.key==='Tab'){ 
          e.preventDefault(); 
          insertAtCursor('    '); 
        } 
      });
    }
    
    if($('#themeToggle')) $('#themeToggle').addEventListener('click', ()=>this.toggleTheme());
    if($('#fullscreenToggle')) $('#fullscreenToggle').addEventListener('click', ()=>this.toggleFullscreen());
    if($('#dirToggle')) $('#dirToggle').addEventListener('click', ()=>this.toggleDirection());
    if($('#clearBtn')) $('#clearBtn').addEventListener('click', ()=>this.clearEditor());
    if($('#importBtn')) $('#importBtn').addEventListener('click', ()=>this.importFile());
    if($('#exportHtml')) $('#exportHtml').addEventListener('click', ()=>this.exportHTML());
    if($('#exportPdf')) $('#exportPdf').addEventListener('click', ()=>this.exportPDF());
    if($('#togglePreview')) $('#togglePreview').addEventListener('click', (e)=>this.togglePreview(e.target));
    if($('#saveBtn')) $('#saveBtn').addEventListener('click', ()=>this.exportMarkdown());
    if($('#loadBtn')) $('#loadBtn').addEventListener('click', ()=>this.importFile());
    
    // modals
    if($('#insertLink')) $('#insertLink').addEventListener('click', ()=>this.insertLink());
    if($('#cancelLink')) $('#cancelLink').addEventListener('click', ()=>this.hideModal('linkModal'));
    if($('#insertImage')) $('#insertImage').addEventListener('click', ()=>this.insertImage());
    if($('#cancelImage')) $('#cancelImage').addEventListener('click', ()=>this.hideModal('imageModal'));
    
    // focus buttons
    if($('#focusEditorBtn')) $('#focusEditorBtn').addEventListener('click', ()=>this.toggleFocus('editor'));
    if($('#focusPreviewBtn')) $('#focusPreviewBtn').addEventListener('click', ()=>this.toggleFocus('preview'));
    
    $all('.modal').forEach(m => m.addEventListener('click', (e)=>{ 
      if(e.target===m) this.hideModal(m.id); 
    }));
    
    // sync scroll
    if(this.editor) this.editor.addEventListener('scroll', ()=>this.syncScrollEditor());
    if(this.preview) this.preview.addEventListener('scroll', ()=>this.syncScrollPreview());
  }

  executeCommand(cmd){
    const ta = this.editor; 
    const start = ta.selectionStart; 
    const end = ta.selectionEnd; 
    const sel = ta.value.substring(start,end);
    
    const wrap=(before,after)=>{ 
      const replacement = sel ? before+sel+after : before+after; 
      ta.setRangeText(replacement, start, end, 'end'); 
      if(!sel){ 
        ta.selectionStart = start + before.length; 
        ta.selectionEnd = ta.selectionStart; 
      } 
      ta.focus(); 
      ta.dispatchEvent(new Event('input',{bubbles:true})); 
    };
    
    const prefixLine = (prefix)=>{ 
      const pos = ta.selectionStart; 
      const value = ta.value; 
      const lineStart = value.lastIndexOf('\n', pos-1) + 1; 
      ta.value = value.slice(0,lineStart) + prefix + value.slice(lineStart); 
      ta.selectionStart = ta.selectionEnd = pos + prefix.length; 
      ta.focus(); 
      ta.dispatchEvent(new Event('input',{bubbles:true})); 
    };
    
    const align = (a)=>{ 
      if(!sel){ 
        insertAtCursor(`<p style="text-align:${a};">\n</p>`); 
        ta.selectionStart -= 4; 
        ta.selectionEnd = ta.selectionStart; 
      } else {
        wrap(`<p style="text-align:${a};">\n${sel}\n</p>`,''); 
      }
    };
    
    switch(cmd){
      case 'bold': wrap('**','**'); break;
      case 'italic': wrap('*','*'); break;
      case 'code': wrap('`','`'); break;
      case 'codeblock': wrap('\n```\n','\n```\n'); break;
      case 'blockquote': prefixLine('> '); break;
      case 'hr': insertAtCursor('\n\n---\n\n'); break;
      case 'h1': prefixLine('# '); break;
      case 'h2': prefixLine('## '); break;
      case 'h3': prefixLine('### '); break;
      case 'h4': prefixLine('#### '); break;
      case 'h5': prefixLine('##### '); break;
      case 'h6': prefixLine('###### '); break;
      case 'ul': prefixLine('- '); break;
      case 'ol': prefixLine('1. '); break;
      case 'task': prefixLine('- [ ] '); break;
      case 'table':
        insertAtCursor('\n\n| ترويسة 1 | ترويسة 2 | ترويسة 3 |\n| :--- | :---: | ---: |\n| محتوى 1 | محتوى 2 | محتوى 3 |\n'); break;
      case 'link': this.showModal('linkModal'); break;
      case 'image': this.showModal('imageModal'); break;
      case 'align-left': align('left'); break;
      case 'align-center': align('center'); break;
      case 'align-right': align('right'); break;
      default: break;
    }
  }

  _updatePreview(){ 
    const md = this.editor.value; 
    if(!md.trim()){ 
      this.preview.innerHTML = '<p class="preview-empty">اكتب شيئًا ليعرض هنا...</p>'; 
      return; 
    } 
    try{ 
      this.preview.innerHTML = marked.parse(md); 
    }catch(e){ 
      this.preview.innerHTML = '<p class="preview-error">⚠️ خطأ في تحويل الماركداون</p>'; 
      console.error(e); 
    } 
  }

  _debounce(fn, wait=200){ 
    let t=null; 
    return (...args)=>{ 
      clearTimeout(t); 
      t=setTimeout(()=>fn.apply(this,args), wait); 
    }; 
  }

  updateStats(){ 
    const text = this.editor.value; 
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const lines = text.split(/\n/).length;
    
    $('#wordCount').textContent = `الكلمات: ${words}`; 
    $('#charCount').textContent = `الحروف: ${chars}`; 
    $('#lineCount').textContent = `السطور: ${lines}`; 
  }

  _saveToStorage(){ 
    localStorage.setItem('gt-markdawin-content', this.editor.value); 
  }

  loadSaved(){
    const s = localStorage.getItem('gt-markdawin-content'); 
    if(s && this.editor) this.editor.value = s;
    
    const savedTheme = localStorage.getItem('gt-markdawin-theme'); 
    if(savedTheme) this.theme=savedTheme; 
    document.documentElement.setAttribute('data-theme', this.theme);
    
    const t = $('#themeToggle'); 
    if(t) t.textContent = this.theme==='dark' ? '☀️' : '🌙';
    
    const savedFont = localStorage.getItem('gt-markdawin-font'); 
    if(savedFont && this.fontSelector) {
      setTimeout(()=>{ 
        if([...this.fontSelector.options].some(o=>o.value===savedFont)){ 
          this.fontSelector.value = savedFont; 
          this.fontSelector.dispatchEvent(new Event('change')); 
        } 
      },800);
    }
    
    const savedDir = localStorage.getItem('gt-markdawin-dir'); 
    if(savedDir){
      document.documentElement.setAttribute('dir', savedDir); 
      document.body.setAttribute('dir', savedDir); 
      if(this.editor) this.editor.setAttribute('dir', savedDir); 
    } else { 
      const defaultDir = document.documentElement.getAttribute('dir') || 'rtl';
      document.documentElement.setAttribute('dir', defaultDir); 
      document.body.setAttribute('dir', defaultDir); 
      if(this.editor) this.editor.setAttribute('dir', defaultDir); 
    }
  }

  showModal(id){ 
    const el=$(`#${id}`); 
    if(!el) return; 
    el.classList.remove('hidden'); 
    const input = el.querySelector('input'); 
    if(input) input.focus(); 
  }
  
  hideModal(id){ 
    const el=$(`#${id}`); 
    if(!el) return; 
    el.classList.add('hidden'); 
  }

  insertLink(){ 
    const text = $('#linkText').value || 'نص الرابط'; 
    const url = $('#linkUrl').value; 
    if(url){ 
      insertAtCursor(`[${text}](${url})`); 
      $('#linkText').value=''; 
      $('#linkUrl').value=''; 
      this.hideModal('linkModal'); 
      this.updatePreview(); 
    } else {
      notifier.show('الرجاء إدخال رابط','error'); 
    }
  }
  
  insertImage(){ 
    const alt = $('#imageAlt').value || 'نص بديل'; 
    const url = $('#imageUrl').value; 
    if(url){ 
      insertAtCursor(`![${alt}](${url})`); 
      $('#imageAlt').value=''; 
      $('#imageUrl').value=''; 
      this.hideModal('imageModal'); 
      this.updatePreview(); 
    } else {
      notifier.show('الرجاء إدخال رابط الصورة','error'); 
    }
  }

  toggleTheme(){ 
    this.theme = this.theme === 'dark' ? 'light' : 'dark'; 
    document.documentElement.setAttribute('data-theme', this.theme); 
    const t = $('#themeToggle'); 
    if(t) t.textContent = this.theme==='dark' ? '☀️' : '🌙'; 
    localStorage.setItem('gt-markdawin-theme', this.theme); 
  }
  
  toggleFullscreen(){ 
    if(!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e=>notifier.show(`خطأ: ${e.message}`,'error'));
    } else {
      document.exitFullscreen(); 
    }
  }
  
  toggleDirection(){ 
    const cur = document.body.getAttribute('dir') || document.documentElement.getAttribute('dir') || 'rtl'; 
    const next = cur === 'rtl' ? 'ltr' : 'rtl'; 
    document.documentElement.setAttribute('dir', next); 
    document.body.setAttribute('dir', next); 
    if(this.editor) this.editor.setAttribute('dir', next); 
    localStorage.setItem('gt-markdawin-dir', next); 
    notifier.show(`اتجاه النص: ${next.toUpperCase()}`,'success',900); 
  }

  clearEditor(){ 
    if(confirm('هل أنت متأكد من رغبتك في مسح كل المحتوى؟')){ 
      this.editor.value=''; 
      this.editor.dispatchEvent(new Event('input',{bubbles:true})); 
      notifier.show('تم مسح المحتوى','info'); 
    } 
  }

  togglePreview(btn){
    const container = document.querySelector('.editor-container'); 
    if(!container) return;
    
    this.isPreviewVisible = !this.isPreviewVisible;
    
    if(this.isPreviewVisible){
      container.classList.remove('editor-full','preview-full'); 
      container.classList.add('split'); 
      
      document.querySelector('.preview-panel').style.display='flex'; 
      document.querySelector('.editor-panel').style.display='flex'; 
      document.querySelector('.editor-container').style.gridTemplateColumns='1fr 1fr'; 
      
      if(btn) btn.textContent='إخفاء المعاينة'; 
    } else { 
      container.classList.remove('split','preview-full'); 
      container.classList.add('editor-full'); 
      
      document.querySelector('.preview-panel').style.display='none'; 
      document.querySelector('.editor-panel').style.display='flex'; 
      document.querySelector('.editor-container').style.gridTemplateColumns='1fr'; 
      
      if(btn) btn.textContent='إظهار المعاينة'; 
    }
  }

  toggleFocus(target){
    const container = document.querySelector('.editor-container'); 
    if(!container) return;
    
    if(target==='editor'){
      if(container.classList.contains('editor-full')){
        container.classList.remove('editor-full'); 
        container.classList.add('split'); 
        
        document.querySelector('.preview-panel').style.display='flex'; 
        document.querySelector('.editor-panel').style.display='flex'; 
        document.querySelector('.editor-container').style.gridTemplateColumns='1fr 1fr'; 
        
        notifier.show('عاد العرض إلى الوضع المتساوي','info',900); 
      } else { 
        container.classList.remove('split','preview-full'); 
        container.classList.add('editor-full'); 
        
        document.querySelector('.preview-panel').style.display='none'; 
        document.querySelector('.editor-panel').style.display='flex'; 
        document.querySelector('.editor-container').style.gridTemplateColumns='1fr'; 
        
        notifier.show('المحرر الآن في وضع التكبير','success',900); 
      }
    } else if(target==='preview'){
      if(container.classList.contains('preview-full')){
        container.classList.remove('preview-full'); 
        container.classList.add('split'); 
        
        document.querySelector('.preview-panel').style.display='flex'; 
        document.querySelector('.editor-panel').style.display='flex'; 
        document.querySelector('.editor-container').style.gridTemplateColumns='1fr 1fr'; 
        
        notifier.show('عاد العرض إلى الوضع المتساوي','info',900); 
      } else { 
        container.classList.remove('split','editor-full'); 
        container.classList.add('preview-full'); 
        
        document.querySelector('.editor-panel').style.display='none'; 
        document.querySelector('.preview-panel').style.display='flex'; 
        document.querySelector('.editor-container').style.gridTemplateColumns='1fr'; 
        
        notifier.show('المعاينة الآن في وضع التكبير','success',900); 
      }
    }
  }

  importFile(){ 
    const input=document.createElement('input'); 
    input.type='file'; 
    input.accept='.md,.txt,.markdown'; 
    input.onchange=(e)=>{ 
      const f=e.target.files[0]; 
      if(f){ 
        const r=new FileReader(); 
        r.onload=(ev)=>{ 
          this.editor.value = ev.target.result; 
          this.editor.dispatchEvent(new Event('input',{bubbles:true})); 
          notifier.show(`تم تحميل ${f.name}`,'success'); 
        }; 
        r.readAsText(f); 
      } 
    }; 
    input.click(); 
  }

  _download(filename, text, type){ 
    const a=document.createElement('a'); 
    a.setAttribute('href', `data:${type};charset=utf-8,${encodeURIComponent(text)}`); 
    a.setAttribute('download', filename); 
    a.style.display='none'; 
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a); 
    notifier.show(`تم حفظ ${filename}`,'success'); 
  }
  
  exportMarkdown(){ 
    this._download('document.md', this.editor.value, 'text/markdown'); 
  }
  
  exportHTML(){ 
    const content=this.preview.innerHTML; 
    const fullHtml=`<!doctype html><html lang="ar" dir="${document.body.getAttribute('dir')||'rtl'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مستند</title></head><body>${content}</body></html>`; 
    this._download('document.html', fullHtml, 'text/html'); 
  }

  /* exportPDF محسن - يعمل في جميع الحالات */
  async exportPDF() {
    // تحديث المعاينة أولاً
    this._updatePreview();
    
    if (!this.preview || !this.preview.innerHTML.trim() || 
        this.preview.innerHTML.includes('preview-empty')) { 
      notifier.show('لا يوجد محتوى في المعاينة للتصدير.', 'error', 1600); 
      return; 
    }

    notifier.show('جارٍ تحضير PDF...', 'info', 1500);

    // محاولة استخدام html2pdf أولاً
    if (typeof html2pdf !== 'undefined') {
      try {
        // إنشاء نسخة من عنصر المعاينة مع أنماط محسنة
        const element = this.preview;
        
        // إعدادات html2pdf
        const opt = {
          margin: [15, 15, 15, 15],
          filename: `GT-MARKDAWIN-${new Date().toISOString().slice(0,10)}.pdf`,
          image: { 
            type: 'jpeg', 
            quality: 0.95 
          },
          html2canvas: { 
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: this.theme === 'dark' ? '#000000' : '#ffffff',
            windowWidth: 794, // A4 width in pixels at 96 DPI
            onclone: function(clonedDoc, element) {
              // تحسين النسخة المستنسخة للطباعة
              const body = clonedDoc.body;
              body.style.cssText = `
                direction: ${document.body.getAttribute('dir') || 'rtl'};
                font-family: ${document.documentElement.style.getPropertyValue('--app-font') || 'Arial, sans-serif'};
                padding: 20px;
                max-width: 100%;
                overflow-wrap: break-word;
                background: ${clonedDoc.documentElement.getAttribute('data-theme') === 'dark' ? '#000' : '#fff'};
                color: ${clonedDoc.documentElement.getAttribute('data-theme') === 'dark' ? '#fff' : '#000'};
              `;
              
              // إضافة أنماط إضافية للعناصر
              const style = document.createElement('style');
              style.textContent = `
                * { 
                  max-width: 100% !important;
                  box-sizing: border-box;
                }
                table { 
                  border-collapse: collapse; 
                  width: 100% !important;
                  margin: 10px 0;
                }
                th, td { 
                  border: 1px solid #ddd; 
                  padding: 8px;
                  text-align: right;
                }
                img { 
                  max-width: 100% !important; 
                  height: auto !important;
                }
                pre, code { 
                  white-space: pre-wrap !important;
                  word-break: break-word !important;
                }
                h1, h2, h3, h4, h5, h6 {
                  page-break-after: avoid;
                }
                p {
                  margin: 8px 0;
                  line-height: 1.6;
                }
              `;
              clonedDoc.head.appendChild(style);
            }
          },
          jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'portrait',
            compress: true,
            hotfixes: ['px_scaling']
          }
        };
        
        // التصدير
        await html2pdf().set(opt).from(element).save();
        notifier.show('✅ تم تصدير PDF بنجاح', 'success', 2000);
        return;
        
      } catch (error) {
        console.warn('html2pdf فشل، استخدام الطباعة البديلة:', error);
      }
    }
    
    // البديل: استخدام نافذة الطباعة
    this.exportViaPrint();
  }

  /* دالة مساعدة للطباعة كـ PDF */
  exportViaPrint() {
    // إنشاء نافذة طباعة
    const printWindow = window.open('', '_blank');
    
    // بناء محتوى الطباعة
    const printDate = new Date().toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const printContent = `
      <!DOCTYPE html>
      <html dir="${document.body.getAttribute('dir') || 'rtl'}">
      <head>
        <meta charset="utf-8">
        <title>GT-MARKDAWIN - ${printDate}</title>
        <style>
          /* أنماط الطباعة */
          @media print {
            @page {
              size: A4;
              margin: 20mm;
            }
            
            body {
              font-family: ${document.documentElement.style.getPropertyValue('--app-font') || 'Arial, sans-serif'};
              direction: ${document.body.getAttribute('dir') || 'rtl'};
              line-height: 1.6;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 0;
              font-size: 12pt;
            }
            
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 15px;
              border-bottom: 2px solid #38a3ff;
            }
            
            .header h1 {
              font-size: 24pt;
              margin: 0 0 10px 0;
              color: #38a3ff;
            }
            
            .header .date {
              color: #666;
              font-size: 11pt;
            }
            
            h1 { font-size: 20pt; margin: 25px 0 15px 0; }
            h2 { font-size: 18pt; margin: 20px 0 12px 0; }
            h3 { font-size: 16pt; margin: 18px 0 10px 0; }
            h4 { font-size: 14pt; margin: 16px 0 8px 0; }
            h5 { font-size: 12pt; margin: 14px 0 6px 0; }
            h6 { font-size: 11pt; margin: 12px 0 4px 0; }
            
            p {
              margin: 10px 0;
              text-align: justify;
              line-height: 1.8;
            }
            
            ul, ol {
              margin: 10px 0;
              padding-right: 25px;
            }
            
            li {
              margin: 6px 0;
            }
            
            blockquote {
              border-right: 3px solid #38a3ff;
              padding: 10px 15px;
              margin: 15px 0;
              background: #f8f9fa;
              border-radius: 5px;
            }
            
            code {
              font-family: 'Courier New', monospace;
              background: #f1f3f4;
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 11pt;
            }
            
            pre {
              font-family: 'Courier New', monospace;
              background: #f8f9fa;
              padding: 12px;
              border-radius: 5px;
              overflow-x: auto;
              white-space: pre-wrap;
              margin: 15px 0;
              border: 1px solid #e1e4e8;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
              font-size: 11pt;
            }
            
            th, td {
              border: 1px solid #ddd;
              padding: 8px 12px;
              text-align: right;
            }
            
            th {
              background: #f8f9fa;
              font-weight: bold;
              color: #333;
            }
            
            img {
              max-width: 100%;
              height: auto;
              display: block;
              margin: 10px auto;
            }
            
            hr {
              border: none;
              border-top: 1px solid #ddd;
              margin: 20px 0;
            }
            
            a {
              color: #38a3ff;
              text-decoration: none;
            }
            
            .page-break {
              page-break-before: always;
            }
            
            .no-print {
              display: none;
            }
            
            .footer {
              margin-top: 40px;
              padding-top: 15px;
              border-top: 1px solid #ddd;
              text-align: center;
              font-size: 10pt;
              color: #666;
            }
          }
          
          /* أنماط الشاشة */
          @media screen {
            body {
              padding: 30px;
              max-width: 800px;
              margin: 0 auto;
              background: #f5f5f5;
              font-family: ${document.documentElement.style.getPropertyValue('--app-font') || 'Arial, sans-serif'};
              direction: ${document.body.getAttribute('dir') || 'rtl'};
            }
            
            .print-instructions {
              background: #fff;
              padding: 20px;
              border-radius: 10px;
              margin-bottom: 30px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              border: 2px solid #38a3ff;
            }
            
            .print-button {
              display: inline-block;
              background: #38a3ff;
              color: white;
              padding: 12px 24px;
              border-radius: 5px;
              text-decoration: none;
              margin: 10px 5px;
              cursor: pointer;
              border: none;
              font-size: 14px;
            }
            
            .print-button:hover {
              background: #2a8ae6;
            }
            
            .content {
              background: white;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
          }
        </style>
      </head>
      <body>
        <div class="print-instructions">
          <h2>تصدير إلى PDF</h2>
          <p>لحفظ هذا المستند كملف PDF:</p>
          <ol>
            <li>انقر على زر "طباعة" أدناه</li>
            <li>في نافذة الطباعة، اختر "حفظ كـ PDF" كطابعة</li>
            <li>اضبط الإعدادات كما تريد (A4 هو الحجم الافتراضي)</li>
            <li>انقر على "حفظ"</li>
          </ol>
          <div>
            <button onclick="window.print()" class="print-button">🖨️ طباعة / حفظ كـ PDF</button>
            <button onclick="window.close()" class="print-button" style="background: #666;">✖️ إغلاق</button>
          </div>
        </div>
        
        <div class="content">
          <div class="header no-print">
            <h1>GT-MARKDAWIN</h1>
            <p class="date">${printDate}</p>
          </div>
          
          <div id="document-content">
            ${this.preview.innerHTML}
          </div>
          
          <div class="footer">
            <p>تم إنشاء هذا المستند بواسطة GT-MARKDAWIN - ${printDate}</p>
          </div>
        </div>
        
        <script>
          // طباعة تلقائية بعد تحميل الصفحة
          window.addEventListener('load', function() {
            setTimeout(function() {
              // يمكن إلغاء التعليق عن السطر التالي للطباعة التلقائية
              // window.print();
            }, 500);
          });
        </script>
      </body>
      </html>
    `;
    
    // كتابة المحتوى إلى النافذة الجديدة
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    notifier.show('✅ فتح نافذة الطباعة. اختر "حفظ كـ PDF"', 'success', 3000);
  }

  _getScrollPercent(el){ 
    const h=el.scrollHeight - el.clientHeight; 
    return (h>0) ? (el.scrollTop/h) : 0; 
  }
  
  syncScrollEditor(){ 
    if(this.isPreviewSyncing){ 
      this.isPreviewSyncing=false; 
      return; 
    } 
    this.isEditorSyncing=true; 
    const p=this._getScrollPercent(this.editor); 
    const target=(this.preview.scrollHeight - this.preview.clientHeight)*p; 
    this.preview.scrollTop = target; 
  }
  
  syncScrollPreview(){ 
    if(this.isEditorSyncing){ 
      this.isEditorSyncing=false; 
      return; 
    } 
    this.isPreviewSyncing=true; 
    const p=this._getScrollPercent(this.preview); 
    const target=(this.editor.scrollHeight - this.editor.clientHeight)*p; 
    this.editor.scrollTop = target; 
  }
}

/* start */
document.addEventListener('DOMContentLoaded', ()=>{
  document.documentElement.setAttribute('data-theme','dark');
  window.app = new GTMarkdaWin();
});
