/* script.js — مُحدّث: إصلاح الإيموجي، حالات التركيز (Editor/Preview)، وتحسين تصدير PDF */

/* ----- إعدادات ----- */
const FONT_EXTENSIONS = ['.woff2','.woff','.ttf','.otf'];

/* ----- اختصارات DOM ----- */
const $ = sel => document.querySelector(sel);
const $all = sel => Array.from(document.querySelectorAll(sel));

/* ----- إشعارات ----- */
const notifier = {
    show(msg, type='info', time=2200){
        const existing = document.querySelector('.gt-notification');
        if(existing) existing.remove();
        const n = document.createElement('div');
        n.className = 'gt-notification';
        n.dataset.type = type;
        n.textContent = msg;
        document.body.appendChild(n);
        setTimeout(()=> n.classList.add('visible'), 20);
        setTimeout(()=> { n.classList.remove('visible'); setTimeout(()=>n.remove(),300); }, time);
    }
};

/* ----- FontManager (كما قبلاً، يبقي @font-face داخل #gt-dynamic-fonts) ----- */
class FontManager {
    constructor(selectEl, importBtn){
        this.selectEl = selectEl;
        this.importBtn = importBtn;
        this.loaded = new Map();
        this.init();
    }

    init(){
        if(this.importBtn && window.showDirectoryPicker){
            this.importBtn.addEventListener('click', ()=>this.pickDirectory());
        } else if(this.importBtn){
            this.importBtn.addEventListener('click', ()=>notifier.show('متصفحك لا يدعم File System Access. استخدم fonts.json أو ضع الملفات في مجلد fonts/', 'info', 3500));
        }
        this.scanFonts();
        this.timer = setInterval(()=>this.scanFonts(), 15000);
        this.selectEl.addEventListener('change', ()=>{
            const v = this.selectEl.value;
            if(v==='__system__') document.documentElement.style.removeProperty('--app-font');
            else document.documentElement.style.setProperty('--app-font', `"${v}", system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial`);
            localStorage.setItem('gt-markdawin-font', v);
        });
        const saved = localStorage.getItem('gt-markdawin-font');
        if(saved) setTimeout(()=>{ if([...this.selectEl.options].some(o=>o.value===saved)) { this.selectEl.value=saved; this.selectEl.dispatchEvent(new Event('change')); } }, 800);
    }

    async pickDirectory(){
        try{
            const dirHandle = await window.showDirectoryPicker();
            const fonts = [];
            for await(const entry of dirHandle.values()){
                if(entry.kind==='file' && FONT_EXTENSIONS.some(ext=>entry.name.toLowerCase().endsWith(ext))){
                    const file = await entry.getFile();
                    const url = URL.createObjectURL(file);
                    fonts.push({name:this.nameFrom(entry.name), url});
                }
            }
            if(fonts.length) this.applyFonts(fonts);
            else notifier.show('لم يتم العثور على خطوط داخل المجلد المختار.', 'info');
        } catch(e){
            console.warn('Directory picker cancelled or failed', e);
            notifier.show('لم تُمنح أذونات الوصول للمجلد أو تم الإلغاء.', 'error', 2000);
        }
    }

    async scanFonts(){
        try {
            const r = await fetch('fonts.json', {cache:'no-cache'});
            if(r.ok){
                const list = await r.json();
                if(Array.isArray(list) && list.length){
                    const fonts = list.map(f=>({name:this.nameFrom(f), url:`fonts/${f}`}));
                    this.applyFonts(fonts);
                    return;
                }
            }
        } catch(e){
            console.warn("Could not load fonts.json, falling back...", e);
        }

        const common = ['Samim','Dubai-Regular','Dubai-Medium','Dubai-Light','Dubai-Bold','Consolas-Regular','UthmanicHafs1 Ver13','ArbFONTS-Amiri-Quran','amiri-quran','Ubuntu Arabic Regular','Ubuntu Arabic Bold','(A) Arslan Wessam A'];
        const candidates = [];
        for(const base of common){
            for(const ext of FONT_EXTENSIONS){
                const url = `fonts/${base}${ext}`;
                try{
                    const h = await fetch(url, {method:'HEAD'});
                    if(h.ok){ candidates.push({name:this.nameFrom(base+ext), url}); break; }
                } catch(e){}
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
        if(!style){ style=document.createElement('style'); style.id=styleId; document.head.appendChild(style);}
        list.forEach(item=>{
            if(this.loaded.has(item.name)) return;
            const ext = item.url.split('.').pop().toLowerCase();
            const fmt = ext==='woff2'?'woff2':(ext==='woff'?'woff':(ext==='ttf'?'truetype':'opentype'));
            const rule=`@font-face { font-family: "${item.name}"; src: url("${item.url}") format("${fmt}"); font-weight: normal; font-style: normal; font-display: swap; }`;
            style.appendChild(document.createTextNode(rule));
            this.loaded.set(item.name,item.url);
            if(![...this.selectEl.options].some(o=>o.value===item.name)){
                const o=document.createElement('option'); o.value=item.name; o.textContent=item.name; this.selectEl.appendChild(o);
            }
            added++;
        });
        if(added) notifier.show(`تم إضافة ${added} خطًا جديدًا. اختره من القائمة.`, 'success', 2600);
        if(![...this.selectEl.options].some(o=>o.value==='__system__')){
            const o=document.createElement('option'); o.value='__system__'; o.textContent='افتراضي النظام'; this.selectEl.prepend(o);
        }
    }
}

/* ----- EmojiManager (يبني ويعرض القائمة داخل #emojiPanel) ----- */
class EmojiManager {
    constructor(panelEl, toggleBtn){
        this.panel=panelEl;
        this.toggleBtn=toggleBtn;
        this.emojis=[];
        this.lastKey='';
        this.init();
    }

    init(){
        if(!this.panel) return;
        // زر الهيدر يفتح/يغلق اللوحة ويضعها بالقرب منه
        this.toggleBtn.addEventListener('click', (e)=> {
            e.stopPropagation();
            this.panel.classList.toggle('hidden');
            const rect = this.toggleBtn.getBoundingClientRect();

            // جعل اللوحة تظهر نسبياً داخل body (ليس modal كامل)
            this.panel.style.position = 'absolute';
            // ضع أسفل الزر
            const top = rect.bottom + window.scrollY + 8;
            // حاول ضبط المحاذاة إذا كان عرض اللوحة يتجاوز النافذة
            let left = rect.left + window.scrollX;
            if ((left + this.panel.offsetWidth) > window.innerWidth) {
                left = Math.max(8, window.innerWidth - this.panel.offsetWidth - 8);
            }

            this.panel.style.top = `${top}px`;
            this.panel.style.left = `${left}px`;
            this.panel.style.right = 'auto';
        });

        // إغلاق عند النقر في أي مكان آخر
        document.addEventListener('click', (e)=>{
            if(!this.panel.classList.contains('hidden') && !this.panel.contains(e.target) && e.target !== this.toggleBtn) {
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
        const emojiList = staticEmojis.map(emoji => ({ name: emoji, text: emoji }));
        this.apply(emojiList);
    }

    apply(list){
        const key = list.map(i=>i.text).join('|');
        if(key === this.lastKey) return;
        this.lastKey = key;
        this.emojis = list;
        this.panel.innerHTML = '';
        if(!list.length){
            this.panel.innerHTML = '<div class="emoji-empty">لا توجد رموز متاحة</div>';
            return;
        }
        const grid = document.createElement('div');
        grid.className = 'emoji-grid';
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(40px,1fr))';
        grid.style.gap = '6px';
        list.forEach(item => {
            const button = document.createElement('button');
            button.className = 'emoji-item';
            button.title = item.name;
            button.textContent = item.text;
            button.style.fontSize = '1.2rem';
            button.style.padding = '6px';
            button.style.border = 'none';
            button.style.background = 'transparent';
            button.style.cursor = 'pointer';
            button.addEventListener('click', () => {
                insertAtCursor(` ${item.text} `);
                notifier.show('تم إدراج رمز تعبيري', 'success', 900);
                this.panel.classList.add('hidden');
            });
            grid.appendChild(button);
        });
        this.panel.appendChild(grid);
    }
}

/* ----- Editor helper ----- */
function insertAtCursor(text){
    const ta = $('#editor');
    const start = ta.selectionStart || 0;
    const end = ta.selectionEnd || 0;
    ta.setRangeText(text, start, end, 'end');
    ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
}

/* ----- التطبيق الرئيسي ----- */
class GTMarkdaWin {
    constructor(){
        this.editor = $('#editor');
        this.preview = $('#preview');
        this.fontSelector = $('#fontSelector');
        this.importFontsBtn = $('#importFontsBtn');
        this.emojiPanel = $('#emojiPanel');
        this.emojiHeaderBtn = $('#emojiBtnHeader');
        this.isPreviewVisible=true;
        this.theme='dark';
        this.isEditorSyncing = false;
        this.isPreviewSyncing = false;
        this.init();
    }

    init(){
        if(typeof marked==='undefined'){
            setTimeout(()=>{ if(typeof marked==='undefined') notifier.show('مكتبة marked غير محملة. تأكد من وجود marked.umd.js','error'); else this.afterMarked(); }, 300);
            return;
        }
        this.afterMarked();
    }

    afterMarked(){
        marked.setOptions({breaks:true, gfm:true, headerIds:true, mangle:false, smartLists:true});
        this.bindUI();
        // تأكد من وجود عناصر تم تمريرها
        this.fontManager = this.fontSelector ? new FontManager(this.fontSelector, this.importFontsBtn) : null;
        this.emojiManager = (this.emojiPanel && this.emojiHeaderBtn) ? new EmojiManager(this.emojiPanel, this.emojiHeaderBtn) : null;
        this.loadSaved();

        this.updatePreview = this._debounce(()=>this._updatePreview(), 180);
        this.saveToStorage = this._debounce(()=>this._saveToStorage(), 300);

        this._updatePreview();
        this.updateStats();
        notifier.show('GT-MARKDAWIN جاهز 🎉','success',1200);
    }

    bindUI(){
        $all('.toolbar-btn').forEach(btn=>btn.addEventListener('click', ()=>this.executeCommand(btn.dataset.cmd)));

        this.editor && this.editor.addEventListener('input', ()=>{
            this.updatePreview();
            this.saveToStorage();
            this.updateStats();
        });
        this.editor && this.editor.addEventListener('keydown',(e)=>{
            if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='b'){ e.preventDefault(); this.executeCommand('bold'); }
            if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='i'){ e.preventDefault(); this.executeCommand('italic'); }
            if(e.key === 'Tab') { e.preventDefault(); insertAtCursor('    '); }
        });

        $('#themeToggle') && $('#themeToggle').addEventListener('click', () => this.toggleTheme());
        $('#fullscreenToggle') && $('#fullscreenToggle').addEventListener('click', () => this.toggleFullscreen());
        $('#dirToggle') && $('#dirToggle').addEventListener('click', () => this.toggleDirection());

        $('#clearBtn') && $('#clearBtn').addEventListener('click', () => this.clearEditor());
        $('#importBtn') && $('#importBtn').addEventListener('click', () => this.importFile());

        $('#exportHtml') && $('#exportHtml').addEventListener('click', () => this.exportHTML());
        $('#exportPdf') && $('#exportPdf').addEventListener('click', () => this.exportPDF());
        $('#togglePreview') && $('#togglePreview').addEventListener('click', (e) => this.togglePreview(e.target));

        $('#saveBtn') && $('#saveBtn').addEventListener('click', () => this.exportMarkdown());
        $('#loadBtn') && $('#loadBtn').addEventListener('click', () => this.importFile());

        $('#insertLink') && $('#insertLink').addEventListener('click', () => this.insertLink());
        $('#cancelLink') && $('#cancelLink').addEventListener('click', () => this.hideModal('linkModal'));
        $('#insertImage') && $('#insertImage').addEventListener('click', () => this.insertImage());
        $('#cancelImage') && $('#cancelImage').addEventListener('click', () => this.hideModal('imageModal'));

        // أزرار التركيز (تكبير المحرر / المعاينة)
        $('#focusEditorBtn') && $('#focusEditorBtn').addEventListener('click', () => this.toggleFocus('editor'));
        $('#focusPreviewBtn') && $('#focusPreviewBtn').addEventListener('click', () => this.toggleFocus('preview'));

        // إغلاق النوافذ عند النقر خارجها
        $all('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id);
                }
            });
        });

        // تمرير متزامن
        this.editor && this.editor.addEventListener('scroll', () => this.syncScrollEditor());
        this.preview && this.preview.addEventListener('scroll', () => this.syncScrollPreview());
    }

    executeCommand(cmd){
        const ta = this.editor;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const sel = ta.value.substring(start,end);

        const wrap=(before,after)=>{
            const replacement = sel ? before+sel+after : before+after;
            ta.setRangeText(replacement,start,end,'end');
            if (!sel) { ta.selectionStart = start + before.length; ta.selectionEnd = ta.selectionStart; }
            ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true }));
        };

        const prefixLine=(prefix)=>{
            const pos = ta.selectionStart;
            const value = ta.value;
            const lineStart = value.lastIndexOf('\n', pos-1)+1;
            ta.value = value.slice(0,lineStart)+prefix+value.slice(lineStart);
            ta.selectionStart=ta.selectionEnd=pos+prefix.length;
            ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true }));
        };

        const align = (alignment) => {
            if (!sel) {
                insertAtCursor(`<p style="text-align:${alignment};"></p>`);
                ta.selectionStart -= 4;
                ta.selectionEnd = ta.selectionStart;
            } else {
                wrap(`<p style="text-align:${alignment};">\n${sel}\n</p>`, '');
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
                insertAtCursor('\n| ترويسة 1 | ترويسة 2 | ترويسة 3 |\n| :--- | :---: | ---: |\n| محتوى 1 | محتوى 2 | محتوى 3 |\n| محتوى 4 | محتوى 5 | محتوى 6 |\n');
                break;
            case 'link': this.showModal('linkModal'); break;
            case 'image': this.showModal('imageModal'); break;
            case 'align-left': align('left'); break;
            case 'align-center': align('center'); break;
            case 'align-right': align('right'); break;
            default: break;
        }
    }

    _updatePreview(){
        const md=this.editor.value;
        if(!md.trim()){ this.preview.innerHTML='<p class="preview-empty">اكتب شيئًا ليعرض هنا...</p>'; return; }
        try{ this.preview.innerHTML=marked.parse(md); } catch(e){ this.preview.innerHTML='<p class="preview-error">⚠️ خطأ في تحويل الماركداون</p>'; console.error(e); }
    }

    _debounce(fn, wait=200){
        let t=null; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args), wait); };
    }

    updatePreview(){ this.updatePreview = this.updatePreview || this._debounce(()=>this._updatePreview(),180); this.updatePreview(); }

    updateStats(){
        const text=this.editor.value;
        $('#wordCount').textContent=`الكلمات: ${text.trim()? text.trim().split(/\s+/).length:0}`;
        $('#charCount').textContent=`الحروف: ${text.length}`;
        $('#lineCount').textContent=`السطور: ${text.split(/\n/).length}`;
    }

    _saveToStorage(){
        localStorage.setItem('gt-markdawin-content', this.editor.value);
    }

    loadSaved(){
        const savedContent = localStorage.getItem('gt-markdawin-content');
        if (savedContent) this.editor.value = savedContent;

        const savedTheme = localStorage.getItem('gt-markdawin-theme');
        if (savedTheme) this.theme = savedTheme;
        document.documentElement.setAttribute('data-theme', this.theme);
        const themeToggle = $('#themeToggle');
        if (themeToggle) themeToggle.textContent = this.theme === 'dark' ? '☀️' : '🌙';

        const savedFont = localStorage.getItem('gt-markdawin-font');
        if (savedFont && this.fontSelector) {
            setTimeout(()=>{ if([...this.fontSelector.options].some(o=>o.value===savedFont)) { this.fontSelector.value=savedFont; this.fontSelector.dispatchEvent(new Event('change')); } }, 800);
        }

        const savedDir = localStorage.getItem('gt-markdawin-dir');
        if (savedDir) {
            document.documentElement.setAttribute('dir', savedDir);
            document.body.setAttribute('dir', savedDir);
            if (this.editor) this.editor.setAttribute('dir', savedDir);
        } else {
            document.documentElement.setAttribute('dir', document.documentElement.getAttribute('dir') || 'rtl');
            document.body.setAttribute('dir', document.body.getAttribute('dir') || 'rtl');
            if (this.editor) this.editor.setAttribute('dir', this.editor.getAttribute('dir') || 'rtl');
        }
    }

    showModal(id) {
        const el = $(`#${id}`);
        if(!el) return;
        el.classList.remove('hidden');
        const input = el.querySelector('input');
        if (input) input.focus();
    }
    hideModal(id) {
        const el = $(`#${id}`);
        if(!el) return;
        el.classList.add('hidden');
    }
    insertLink() {
        const text = $('#linkText').value || 'نص الرابط';
        const url = $('#linkUrl').value;
        if (url) { insertAtCursor(`[${text}](${url})`); $('#linkText').value=''; $('#linkUrl').value=''; this.hideModal('linkModal'); }
        else notifier.show('الرجاء إدخال رابط', 'error');
    }
    insertImage() {
        const alt = $('#imageAlt').value || 'نص بديل';
        const url = $('#imageUrl').value;
        if (url) { insertAtCursor(`![${alt}](${url})`); $('#imageAlt').value=''; $('#imageUrl').value=''; this.hideModal('imageModal'); }
        else notifier.show('الرجاء إدخال رابط الصورة', 'error');
    }

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', this.theme);
        const t = $('#themeToggle'); if (t) t.textContent = this.theme === 'dark' ? '☀️' : '🌙';
        localStorage.setItem('gt-markdawin-theme', this.theme);
    }
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => { notifier.show(`خطأ: ${err.message}`, 'error'); });
        } else { document.exitFullscreen(); }
    }

    toggleDirection() {
        const current = document.body.getAttribute('dir') || document.documentElement.getAttribute('dir') || 'rtl';
        const next = current === 'rtl' ? 'ltr' : 'rtl';
        document.documentElement.setAttribute('dir', next);
        document.body.setAttribute('dir', next);
        if (this.editor) this.editor.setAttribute('dir', next);
        localStorage.setItem('gt-markdawin-dir', next);
        notifier.show(`اتجاه النص مُعد إلى ${next.toUpperCase()}`, 'success', 1200);
    }

    clearEditor() {
        if (confirm('هل أنت متأكد من رغبتك في مسح كل المحتوى؟')) {
            this.editor.value = '';
            this.editor.dispatchEvent(new Event('input', { bubbles: true }));
            notifier.show('تم مسح المحتوى', 'info');
        }
    }

    // Toggle preview visibility (يحافظ على حالات التركيز)
    togglePreview(btn) {
        const container = document.querySelector('.editor-container');
        this.isPreviewVisible = !this.isPreviewVisible;
        if (this.isPreviewVisible) {
            container.classList.remove('editor-full','preview-full');
            container.classList.add('split');
            $('.preview-panel').style.display = 'flex';
            $('.editor-panel').style.display = 'flex';
            $('.editor-container').style.gridTemplateColumns = '1fr 1fr';
            if (btn) btn.textContent = 'إخفاء المعاينة';
        } else {
            // إخفاء المعاينة وإبقاء المحرر مرئياً
            container.classList.remove('split','preview-full');
            container.classList.add('editor-full');
            $('.preview-panel').style.display = 'none';
            $('.editor-panel').style.display = 'flex';
            $('.editor-container').style.gridTemplateColumns = '1fr';
            if (btn) btn.textContent = 'إظهار المعاينة';
        }
    }

    // Toggle focus states: 'editor' أو 'preview' أو reset to split
    toggleFocus(target) {
        const container = document.querySelector('.editor-container');
        if (target === 'editor') {
            if (container.classList.contains('editor-full')) {
                // العودة إلى الوضع المتساوي
                container.classList.remove('editor-full'); container.classList.add('split');
                $('.preview-panel').style.display = 'flex';
                $('.editor-panel').style.display = 'flex';
                $('.editor-container').style.gridTemplateColumns = '1fr 1fr';
                notifier.show('عاد العرض إلى الوضع المتساوي', 'info', 900);
            } else {
                container.classList.remove('split','preview-full'); container.classList.add('editor-full');
                $('.preview-panel').style.display = 'none';
                $('.editor-panel').style.display = 'flex';
                $('.editor-container').style.gridTemplateColumns = '1fr';
                notifier.show('المحرر الآن في وضع التكبير', 'success', 900);
            }
        } else if (target === 'preview') {
            if (container.classList.contains('preview-full')) {
                container.classList.remove('preview-full'); container.classList.add('split');
                $('.preview-panel').style.display = 'flex';
                $('.editor-panel').style.display = 'flex';
                $('.editor-container').style.gridTemplateColumns = '1fr 1fr';
                notifier.show('عاد العرض إلى الوضع المتساوي', 'info', 900);
            } else {
                container.classList.remove('split','editor-full'); container.classList.add('preview-full');
                $('.editor-panel').style.display = 'none';
                $('.preview-panel').style.display = 'flex';
                $('.editor-container').style.gridTemplateColumns = '1fr';
                notifier.show('المعاينة الآن في وضع التكبير', 'success', 900);
            }
        }
    }

    importFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md, .txt, .markdown';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (readEvent) => {
                    this.editor.value = readEvent.target.result;
                    this.editor.dispatchEvent(new Event('input', { bubbles: true }));
                    notifier.show(`تم تحميل ${file.name}`, 'success');
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    _download(filename, text, type) {
        const el = document.createElement('a');
        el.setAttribute('href', `data:${type};charset=utf-8,${encodeURIComponent(text)}`);
        el.setAttribute('download', filename);
        el.style.display = 'none';
        document.body.appendChild(el);
        el.click();
        document.body.removeChild(el);
        notifier.show(`تم حفظ ${filename}`, 'success');
    }
    exportMarkdown() {
        const content = this.editor.value;
        this._download('document.md', content, 'text/markdown');
    }
    exportHTML() {
        const content = this.preview.innerHTML;
        const fullHtml = `<!DOCTYPE html>
        <html lang="ar" dir="${document.body.getAttribute('dir') || 'rtl'}">
        <head>
        <meta charset="utf-8">
        <title>مستند مُصدّر</title>
        <style>
        body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif; line-height: 1.7; max-width: 800px; margin: 2rem auto; padding: 1rem; direction: ${document.body.getAttribute('dir') || 'rtl'}; }
        code { background: #f4f4f4; padding: 2px 5px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace; }
        pre { background: #f4f4f4; padding: 1rem; border-radius: 8px; overflow-x: auto; }
        blockquote { border-right: 4px solid #ccc; padding-right: 1rem; margin-right: 0; color: #666; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
        th { background-color: #f2f2f2; }
        img { max-width: 100%; height: auto; border-radius: 8px; }
        hr { border: none; height: 1px; background-color: #ddd; margin: 2rem 0; }
        </style>
        </head>
        <body>
        ${content}
        </body>
        </html>`;
        this._download('document.html', fullHtml, 'text/html');
    }

    // تصدير PDF — تأكد من تحديث المعاينة، انسخ العقد بالكامل، وأدرج قواعد @font-face إذا وُجدت
    async exportPDF() {
        if (typeof html2pdf === 'undefined') {
            notifier.show('مكتبة التصدير إلى PDF غير متاحة. تأكد من تحميل html2pdf.bundle.min.js', 'error', 3000);
            return;
        }

        // تأكد من أن المعاينة محدثة قبل التصدير
        this._updatePreview();
        // انتظار قصير للسماح لتحديث DOM (debounce قد يكون مفعل)
        await new Promise(r => setTimeout(r, 60));

        // جمع المحتوى (cloneNode يحافظ على العناصر الحقيقية)
        const previewNode = this.preview.cloneNode(true);
        // إذا كانت المعاينة فارغة نصياً، لا تستورد (إعلام المستخدم)
        if (!previewNode || !previewNode.innerHTML.trim()) {
            notifier.show('لا يوجد محتوى في المعاينة للتصدير.', 'error', 2000);
            return;
        }

        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '800px';
        container.style.padding = '20px';
        container.style.background = (document.documentElement.getAttribute('data-theme') === 'dark') ? '#111' : '#fff';
        container.style.color = getComputedStyle(document.documentElement).getPropertyValue('--text') || '#000';
        container.id = 'gt-export-pdf-temp';

        // أضف قواعد الخطوط إن وُجدت
        const fontStyle = document.getElementById('gt-dynamic-fonts');
        if (fontStyle) {
            const clonedStyle = document.createElement('style');
            clonedStyle.id = 'gt-export-fonts';
            clonedStyle.textContent = fontStyle.textContent;
            container.appendChild(clonedStyle);
        }

        // أضف قاعدة اتجاه
        const inlineDir = document.body.getAttribute('dir') || 'rtl';
        const dirStyle = document.createElement('style');
        dirStyle.textContent = `html, body, #gt-export-pdf-temp { direction: ${inlineDir}; }`;
        container.appendChild(dirStyle);

        // ضع نسخة المعاينة في الحاوية
        container.appendChild(previewNode);
        document.body.appendChild(container);

        const opt = {
            margin:       12,
            filename:     'document.pdf',
            image:        { type: 'jpeg', quality: 0.92 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
            await html2pdf().set(opt).from(container).save();
            notifier.show('تم تصدير PDF بنجاح', 'success', 1800);
        } catch (err) {
            console.error('PDF export failed', err);
            notifier.show('فشل في تصدير PDF. افتح وحدة التحكم للمزيد من المعلومات.', 'error', 2600);
        } finally {
            const tmp = document.getElementById('gt-export-pdf-temp');
            if (tmp) tmp.remove();
            const tmpFonts = document.getElementById('gt-export-fonts');
            if (tmpFonts) tmpFonts.remove();
        }
    }

    // التمرير المتزامن
    _getScrollPercent(el) {
        const h = el.scrollHeight - el.clientHeight;
        return (h > 0) ? (el.scrollTop / h) : 0;
    }
    syncScrollEditor() {
        if (this.isPreviewSyncing) { this.isPreviewSyncing = false; return; }
        this.isEditorSyncing = true;
        const percent = this._getScrollPercent(this.editor);
        const targetScroll = (this.preview.scrollHeight - this.preview.clientHeight) * percent;
        this.preview.scrollTop = targetScroll;
    }
    syncScrollPreview() {
        if (this.isEditorSyncing) { this.isEditorSyncing = false; return; }
        this.isPreviewSyncing = true;
        const percent = this._getScrollPercent(this.preview);
        const targetScroll = (this.editor.scrollHeight - this.editor.clientHeight) * percent;
        this.editor.scrollTop = targetScroll;
    }
}

/* ----- بدء التشغيل ----- */
document.addEventListener('DOMContentLoaded', ()=>{
    document.documentElement.setAttribute('data-theme','dark');
    window.app = new GTMarkdaWin();
});
