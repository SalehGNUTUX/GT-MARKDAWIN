/* script.js — تحسينات نهائية: exportPDF عبر html2canvas + تضمين CSS/خطوط، إصلاح scroll في أوضاع التكبير، تفعيل المودالات، وemoji كامل */

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

/* marked default options (ensure tables enabled) */
if(typeof marked !== 'undefined') marked.setOptions({ 
  gfm:true, 
  tables:true, 
  breaks:true, 
  headerIds:true, 
  mangle:false, 
  smartLists:true 
});

/* FontManager — إدارة الخطوط */
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
      this.importBtn.addEventListener('click', ()=>notifier.show('متصفحك لا يدعم File System Access. استخدم fonts.json أو ضع الملفات في مجلد fonts/','info',3500));
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
      else notifier.show('لم يتم العثور على خطوط داخل المجلد المختار.','info');
    }catch(e){ 
      console.warn(e); 
      notifier.show('لم تُمنح أذونات الوصول للمجلد أو تم الإلغاء.','error',2000); 
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
      const rule = `@font-face{ font-family: "${item.name}"; src: url("${item.url}") format("${fmt}"); font-weight: normal; font-style: normal; font-display: swap; }`; 
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
    
    if(added) notifier.show(`تم إضافة ${added} خطًا جديدًا. اختره من القائمة.`, 'success', 2600); 
    
    if(this.selectEl && ![...this.selectEl.options].some(o=>o.value==='__system__')){ 
      const o=document.createElement('option'); 
      o.value='__system__'; 
      o.textContent='افتراضي النظام'; 
      this.selectEl.prepend(o); 
    } 
  }
}

/* EmojiManager: يستخدم رموز Unicode مباشرة */
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
      this.panel.style.position='absolute'; 
      const top = rect.bottom + window.scrollY + 8; 
      let left = rect.left + window.scrollX; 
      if((left + this.panel.offsetWidth) > window.innerWidth) {
        left = Math.max(8, window.innerWidth - this.panel.offsetWidth - 8); 
      }
      this.panel.style.top = `${top}px`; 
      this.panel.style.left = `${left}px`; 
      this.panel.style.right = 'auto'; 
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
    grid.style.display='grid'; 
    grid.style.gridTemplateColumns='repeat(auto-fill,minmax(36px,1fr))'; 
    grid.style.gap='6px';
    grid.style.padding='8px';
    
    emojisList.forEach(emoji=>{
      const b=document.createElement('button'); 
      b.type='button'; 
      b.className='emoji-item'; 
      b.textContent=emoji; 
      b.title=emoji;
      b.style.border='none'; 
      b.style.background='transparent'; 
      b.style.cursor='pointer'; 
      b.style.fontSize='1.2rem';
      b.style.padding='4px';
      b.style.borderRadius='4px';
      
      b.addEventListener('mouseenter', () => {
        b.style.background='rgba(255,255,255,0.1)';
      });
      
      b.addEventListener('mouseleave', () => {
        b.style.background='transparent';
      });
      
      b.addEventListener('click', ()=>{
        insertAtCursor(` ${emoji} `); 
        notifier.show('تم إدراج رمز تعبيري','success',700); 
        this.panel.classList.add('hidden'); 
      });
      
      grid.appendChild(b);
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
    // marked options already set above
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
    notifier.show(`اتجاه النص مُعد إلى ${next.toUpperCase()}`,'success',900); 
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

  /* exportPDF محسن باستخدام html2canvas مباشرة على المحتوى */
  async exportPDF(){
    if(typeof html2pdf === 'undefined'){ 
      notifier.show('مكتبة html2pdf غير متاحة','error',3000); 
      return; 
    }

    // حدّث المعاينة أولاً
    this._updatePreview();
    
    if(!this.preview || !this.preview.innerHTML.trim()){ 
      notifier.show('لا يوجد محتوى في المعاينة للتصدير.','error',1600); 
      return; 
    }

    notifier.show('جارٍ تصدير PDF...','info', 2000);

    try {
      // إنشاء نسخة من المحتوى مع الأنماط المضمنة
      const pdfElement = this.preview.cloneNode(true);
      pdfElement.style.width = '100%';
      pdfElement.style.padding = '20px';
      pdfElement.style.fontFamily = document.documentElement.style.getPropertyValue('--app-font') || 'system-ui';
      
      // أضف الأنماط من الصفحة الحالية
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(el => el.outerHTML)
        .join('\n');
      
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.width = '800px';
      tempDiv.innerHTML = `
        <!DOCTYPE html>
        <html dir="${document.body.getAttribute('dir') || 'rtl'}">
        <head>
          <meta charset="utf-8">
          <style>
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: ${document.documentElement.style.getPropertyValue('--app-font') || 'system-ui'}; 
              direction: ${document.body.getAttribute('dir') || 'rtl'};
            }
            ${styles}
          </style>
        </head>
        <body>
          ${this.preview.innerHTML}
        </body>
        </html>
      `;
      
      document.body.appendChild(tempDiv);
      
      // استخدام html2pdf على العنصر المؤقت
      await html2pdf().set({
        margin: 10,
        filename: 'document.pdf',
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#000' : '#fff'
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait',
          compress: true
        }
      }).from(tempDiv).save();
      
      notifier.show('تم تصدير PDF بنجاح','success',1600);
      document.body.removeChild(tempDiv);
      
    } catch(err) {
      console.error('PDF export failed', err);
      notifier.show('فشل في تصدير PDF. تحقق من Console للأخطاء.', 'error', 4000);
    }
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
