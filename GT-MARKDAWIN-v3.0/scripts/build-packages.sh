#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  GT-MARKDAWIN v3.0 — سكريبت البناء والتحزيم الشامل
#  يبني: AppImage · DEB · RPM · Flatpak · APK (Android)
#  يدعم: Ubuntu/Debian · Fedora/RHEL · Arch Linux · openSUSE
#  المطور: SalehGNUTUX — رخصة GNU GPL v3
#
#  الاستخدام:
#    ./scripts/build-packages.sh [هدف]
#
#  الأهداف:
#    all          ← كل الحزم (Linux + Android)          [افتراضي]
#    linux        ← AppImage + DEB + RPM
#    appimage     ← AppImage فقط
#    deb          ← حزمة DEB فقط
#    rpm          ← حزمة RPM (من DEB موجود)
#    flatpak      ← حزمة Flatpak
#    apk          ← APK أندرويد
#    build        ← بناء React فقط (بدون تحزيم)
#    icons        ← توليد مقاسات الأيقونة
#    check-deps   ← فحص المتطلبات فقط (بدون تثبيت)
#    install-deps ← تثبيت المتطلبات المفقودة فقط
# ══════════════════════════════════════════════════════════════════════════════
set -uo pipefail

# ─── المسارات الأساسية ────────────────────────────────────────────────────────
cd "$(dirname "$0")/.."
ROOT_DIR="$(pwd)"
RELEASE_DIR="$ROOT_DIR/release"
DIST_DIR="$ROOT_DIR/dist"
ICONS_DIR="$ROOT_DIR/build/icons"
ICON_SRC="$ROOT_DIR/public/icon.png"
ANDROID_DIR="$ROOT_DIR/android"

APP_NAME="gt-markdawin"
APP_DISPLAY="GT-MARKDAWIN"
VERSION="$(node -pe "require('./package.json').version" 2>/dev/null || echo "3.0.0")"
ARCH="$(uname -m)"

BUILT=()
FAILED=()
PKGS_INSTALLED=()

mkdir -p "$RELEASE_DIR"

# ─── ألوان الطرفية ───────────────────────────────────────────────────────────
if [ -t 1 ]; then
  GRN='\033[0;32m' RED='\033[0;31m' YLW='\033[1;33m'
  BLU='\033[0;34m' CYN='\033[0;36m' GRY='\033[0;37m' NC='\033[0m'
else
  GRN='' RED='' YLW='' BLU='' CYN='' GRY='' NC=''
fi

ok()    { echo -e "${GRN}  ✅ $*${NC}"; }
err()   { echo -e "${RED}  ❌ $*${NC}"; }
inf()   { echo -e "${BLU}  ℹ  $*${NC}"; }
wrn()   { echo -e "${YLW}  ⚠  $*${NC}"; }
step()  { echo -e "${CYN}▶ $*${NC}"; }
found() { printf "  ${GRN}✓${NC}  %-28s ${GRY}%s${NC}\n" "$1" "$2"; }
miss()  { printf "  ${YLW}✗${NC}  %-28s ${YLW}%s${NC}\n" "$1" "$2"; }

echo ""
echo -e "${BLU}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLU}  ${APP_DISPLAY} ${VERSION} — بناء تلقائي لـ GNU/Linux${NC}"
echo -e "${BLU}  المعمارية: ${ARCH}  |  المطور: SalehGNUTUX${NC}"
echo -e "${BLU}══════════════════════════════════════════════════════════════${NC}"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
#  كشف التوزيعة (باستخدام /etc/os-release أولاً كمصدر أكثر دقة)
# ══════════════════════════════════════════════════════════════════════════════
detect_distro() {
  local ID="" ID_LIKE=""
  if [ -f /etc/os-release ]; then
    ID=$(grep -oP '(?<=^ID=)[^\n]+' /etc/os-release | tr -d '"' | tr '[:upper:]' '[:lower:]')
    ID_LIKE=$(grep -oP '(?<=^ID_LIKE=)[^\n]+' /etc/os-release | tr -d '"' | tr '[:upper:]' '[:lower:]')
  fi

  case "$ID" in
    ubuntu|debian|linuxmint|pop|elementary|zorin|kali|mxlinux|neon)
      echo "debian" ;;
    fedora|rhel|centos|rocky|almalinux|nobara)
      echo "fedora" ;;
    arch|manjaro|endeavouros|garuda|artix)
      echo "arch" ;;
    opensuse*|suse*)
      echo "suse" ;;
    *)
      # Fallback via ID_LIKE
      case "$ID_LIKE" in
        *debian*|*ubuntu*) echo "debian" ;;
        *fedora*|*rhel*)   echo "fedora" ;;
        *arch*)            echo "arch"   ;;
        *suse*)            echo "suse"   ;;
        # Last resort: check for distro-specific files
        *)
          if   [ -f /etc/debian_version ];  then echo "debian"
          elif [ -f /etc/fedora-release ];  then echo "fedora"
          elif [ -f /etc/redhat-release ];  then echo "fedora"
          elif [ -f /etc/arch-release ];    then echo "arch"
          elif [ -f /etc/SUSE-brand ];      then echo "suse"
          else echo "unknown"
          fi ;;
      esac ;;
  esac
}

DISTRO="$(detect_distro)"
OS_NAME=$(grep -oP '(?<=^PRETTY_NAME=)[^\n]+' /etc/os-release 2>/dev/null | tr -d '"' || echo "$DISTRO")
inf "التوزيعة: ${OS_NAME} (عائلة: ${DISTRO})"

SUDO=""
command -v sudo &>/dev/null && SUDO="sudo"

# ══════════════════════════════════════════════════════════════════════════════
#  أدوات الفحص الذكي
# ══════════════════════════════════════════════════════════════════════════════

has_cmd() { command -v "$1" &>/dev/null; }

# فحص إن كان مثبتاً (حسب التوزيعة)
pkg_installed() {
  local PKG="$1"
  case "$DISTRO" in
    debian) dpkg -s "$PKG" &>/dev/null 2>&1 ;;
    fedora) rpm -q "$PKG" &>/dev/null 2>&1 ;;
    arch)   pacman -Q "$PKG" &>/dev/null 2>&1 ;;
    suse)   rpm -q "$PKG" &>/dev/null 2>&1 ;;
    *)      return 1 ;;
  esac
}

# فحص إصدار Node.js (يجب ≥ 18)
node_ok() {
  has_cmd node || return 1
  local VER
  VER=$(node -e "process.exit(parseInt(process.version.slice(1)) >= 18 ? 0 : 1)" 2>/dev/null; echo $?)
  [ "$VER" = "0" ]
}

# ══════════════════════════════════════════════════════════════════════════════
#  فحص المتطلبات الذكي — يكتشف ما هو موجود وما هو مفقود
# ══════════════════════════════════════════════════════════════════════════════

# المصفوفات العالمية للحالة
declare -A TOOL_STATUS=()   # "ok" | "missing" | "old"
declare -a TO_INSTALL=()    # حزم مراد تثبيتها

# دالة فحص أداة واحدة: check_tool "اسم-العرض" "أمر-الفحص" "اسم-الحزمة"
check_tool() {
  local LABEL="$1" CMD="$2" PKG="$3" EXTRA="${4:-}"
  if has_cmd "$CMD" || { [ -n "$EXTRA" ] && has_cmd "$EXTRA"; }; then
    found "$LABEL" "$(command -v "$CMD" 2>/dev/null || command -v "$EXTRA" 2>/dev/null)"
    TOOL_STATUS["$CMD"]="ok"
    return 0
  fi
  # بعض الأدوات لها فحص خاص للحزمة
  if pkg_installed "$PKG"; then
    found "$LABEL" "(مثبّت — قد يحتاج reload)"
    TOOL_STATUS["$CMD"]="ok"
    return 0
  fi
  miss "$LABEL" "مفقود → سيُثبَّت: $PKG"
  TOOL_STATUS["$CMD"]="missing"
  TO_INSTALL+=("$PKG")
  return 1
}

# فحص خاص لـ Node.js مع التحقق من الإصدار
check_node() {
  if node_ok; then
    local VER
    VER=$(node --version 2>/dev/null)
    found "Node.js ≥18" "$VER"
    TOOL_STATUS["node"]="ok"
    return 0
  elif has_cmd node; then
    local VER
    VER=$(node --version 2>/dev/null)
    miss "Node.js ≥18" "إصدار قديم ($VER) — يُحتاج ≥18"
    TOOL_STATUS["node"]="old"
    return 1
  else
    miss "Node.js ≥18" "مفقود"
    TOOL_STATUS["node"]="missing"
    return 1
  fi
}

# فحص خاص لـ libfuse (اسم الحزمة يختلف بين توزيعات)
check_fuse() {
  # AppImage تحتاج libfuse2 أو libfuse2t64
  if ldconfig -p 2>/dev/null | grep -q "libfuse.so.2"; then
    found "libfuse2" "(مكتبة موجودة)"
    TOOL_STATUS["libfuse"]="ok"
    return 0
  fi
  # Ubuntu 24+ يستخدم libfuse2t64
  if pkg_installed "libfuse2t64" 2>/dev/null; then
    found "libfuse2" "(libfuse2t64 موجود)"
    TOOL_STATUS["libfuse"]="ok"
    return 0
  fi
  if pkg_installed "libfuse2" 2>/dev/null; then
    found "libfuse2" "(مثبّت)"
    TOOL_STATUS["libfuse"]="ok"
    return 0
  fi
  miss "libfuse2" "مطلوب لـ AppImage"
  TOOL_STATUS["libfuse"]="missing"
  # اختيار الاسم الصحيح حسب التوزيعة
  if apt-cache show libfuse2t64 &>/dev/null 2>&1; then
    TO_INSTALL+=("libfuse2t64")
  elif apt-cache show libfuse2 &>/dev/null 2>&1; then
    TO_INSTALL+=("libfuse2")
  fi
}

# فحص أدوات RPM المتاحة (rpmbuild أو alien)
check_rpm_tools() {
  if has_cmd rpmbuild; then
    found "rpmbuild" "$(command -v rpmbuild)"
    TOOL_STATUS["rpmbuild"]="ok"
  elif has_cmd alien; then
    found "alien (DEB→RPM)" "$(command -v alien)"
    TOOL_STATUS["rpmbuild"]="ok"  # alien كبديل
  else
    miss "rpmbuild / alien" "مطلوب لبناء RPM"
    TOOL_STATUS["rpmbuild"]="missing"
    case "$DISTRO" in
      debian) TO_INSTALL+=("rpm" "alien") ;;
      fedora) TO_INSTALL+=("rpm-build") ;;
      arch)   TO_INSTALL+=("rpm-tools") ;;
      suse)   TO_INSTALL+=("rpm-build") ;;
    esac
  fi
}

# الفحص الرئيسي لجميع الأدوات
run_checks() {
  local TARGET="${1:-all}"
  TO_INSTALL=()
  step "فحص المتطلبات المطلوبة لـ: $TARGET"
  echo ""

  # ── Node.js (مطلوب دائماً) ──
  check_node
  if [ "${TOOL_STATUS[node]:-missing}" != "ok" ]; then
    case "$DISTRO" in
      debian) TO_INSTALL+=("nodejs") ;;
      fedora) TO_INSTALL+=("nodejs") ;;
      arch)   TO_INSTALL+=("nodejs") ;;
      suse)   TO_INSTALL+=("nodejs") ;;
    esac
  fi
  check_tool "npm" "npm" "npm"

  # ── أدوات الأيقونات ──
  check_tool "ImageMagick (convert)" "convert" "imagemagick" ""

  # ── أدوات حسب الهدف ──
  case "$TARGET" in
  all|linux|appimage)
    case "$DISTRO" in
      debian) check_fuse ;;
    esac
    ;;
  esac

  case "$TARGET" in
  all|linux|deb)
    case "$DISTRO" in
      debian)
        check_tool "fakeroot" "fakeroot" "fakeroot"
        check_tool "dpkg-deb" "dpkg-deb" "dpkg-dev"
        ;;
      fedora) check_tool "rpm-build" "rpmbuild" "rpm-build" ;;
    esac
    ;;
  esac

  case "$TARGET" in
  all|linux|rpm)
    check_rpm_tools
    case "$DISTRO" in
      debian)
        has_cmd dpkg-deb || check_tool "dpkg-deb" "dpkg-deb" "dpkg-dev"
        has_cmd fakeroot  || check_tool "fakeroot" "fakeroot" "fakeroot"
        ;;
    esac
    ;;
  esac

  case "$TARGET" in
  all|flatpak)
    check_tool "flatpak-builder" "flatpak-builder" \
      "$([ "$DISTRO" = debian ] && echo 'flatpak-builder' || echo 'flatpak-builder')"
    check_tool "flatpak" "flatpak" "flatpak"
    ;;
  esac

  case "$TARGET" in
  all|apk)
    check_tool "Java (JDK)" "java" \
      "$([ "$DISTRO" = debian ] && echo 'default-jdk-headless' || echo 'java-17-openjdk')"
    ;;
  esac

  # أدوات مساعدة
  check_tool "wget" "wget" "wget"
  check_tool "curl" "curl" "curl"

  echo ""
  if [ ${#TO_INSTALL[@]} -eq 0 ]; then
    ok "جميع المتطلبات جاهزة — لا شيء يحتاج تثبيتاً"
    return 0
  else
    wrn "${#TO_INSTALL[@]} أداة/حزمة مفقودة: ${TO_INSTALL[*]}"
    return 1
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
#  تثبيت المتطلبات المفقودة فقط (بعد run_checks)
# ══════════════════════════════════════════════════════════════════════════════
install_missing() {
  [ ${#TO_INSTALL[@]} -eq 0 ] && return 0

  # إزالة التكرار من قائمة التثبيت
  local UNIQUE_PKGS=()
  declare -A SEEN=()
  for P in "${TO_INSTALL[@]}"; do
    [ -z "${SEEN[$P]:-}" ] && UNIQUE_PKGS+=("$P") && SEEN["$P"]=1
  done

  step "تثبيت ${#UNIQUE_PKGS[@]} حزمة مفقودة: ${UNIQUE_PKGS[*]}"

  case "$DISTRO" in
  debian)
    $SUDO apt-get update -qq 2>/dev/null || true
    $SUDO apt-get install -y --no-install-recommends "${UNIQUE_PKGS[@]}" 2>&1 | \
      grep -E "(Setting up|already|error|E:)" || true
    ;;
  fedora)
    $SUDO dnf install -y "${UNIQUE_PKGS[@]}" 2>&1 | \
      grep -E "(Installing|already|error)" || true
    ;;
  arch)
    $SUDO pacman -S --noconfirm --needed "${UNIQUE_PKGS[@]}" 2>&1 | \
      grep -E "(installing|already|error)" || true
    ;;
  suse)
    $SUDO zypper install -y --no-confirm "${UNIQUE_PKGS[@]}" 2>&1 | \
      grep -E "(Installing|already|error)" || true
    ;;
  *)
    err "توزيعة غير مدعومة للتثبيت التلقائي — ثبّت يدوياً: ${UNIQUE_PKGS[*]}"
    return 1
    ;;
  esac

  # التحقق من النجاح
  local STILL_MISSING=()
  for PKG in "${UNIQUE_PKGS[@]}"; do
    pkg_installed "$PKG" 2>/dev/null || STILL_MISSING+=("$PKG")
  done

  if [ ${#STILL_MISSING[@]} -gt 0 ]; then
    wrn "لم يُثبَّت: ${STILL_MISSING[*]}"
  else
    ok "تم تثبيت جميع الحزم المطلوبة"
    PKGS_INSTALLED+=("${UNIQUE_PKGS[@]}")
  fi

  # ── ترقية Node.js إذا كان الإصدار قديماً ──
  if [ "${TOOL_STATUS[node]:-}" = "old" ]; then
    inf "محاولة ترقية Node.js عبر NodeSource..."
    case "$DISTRO" in
    debian)
      if has_cmd curl; then
        curl -fsSL https://deb.nodesource.com/setup_lts.x | $SUDO bash - 2>/dev/null && \
          $SUDO apt-get install -y nodejs && ok "تم ترقية Node.js" || \
          wrn "تعذّرت الترقية — استمر مع الإصدار الحالي"
      fi ;;
    fedora)
      $SUDO dnf module install -y nodejs:lts 2>/dev/null && ok "تم ترقية Node.js" || \
        wrn "تعذّرت الترقية" ;;
    esac
  fi
}

# دالة موحدة: فحص + تثبيت ما يلزم قبل البناء
ensure_deps() {
  local TARGET="${1:-all}"
  run_checks "$TARGET"
  local NEEDS_INSTALL=$?
  [ $NEEDS_INSTALL -ne 0 ] && install_missing
  echo ""
}

# ══════════════════════════════════════════════════════════════════════════════
#  توليد الأيقونات (فقط إذا كانت مفقودة أو الأصل أحدث)
# ══════════════════════════════════════════════════════════════════════════════
generate_icons() {
  if [ ! -f "$ICON_SRC" ]; then
    err "الأيقونة غير موجودة: $ICON_SRC"
    return 1
  fi

  # تحقق: هل الأيقونات موجودة وأحدث من المصدر؟
  local NEED_REGEN=false
  if [ ! -f "$ICONS_DIR/512x512.png" ]; then
    NEED_REGEN=true
  elif [ "$ICON_SRC" -nt "$ICONS_DIR/512x512.png" ]; then
    NEED_REGEN=true
    inf "الأيقونة المصدر أُحدِّثت — إعادة توليد المقاسات..."
  fi

  if [ "$NEED_REGEN" = false ]; then
    found "أيقونات build/icons/" "$(ls "$ICONS_DIR"/*.png 2>/dev/null | wc -l) مقاس موجود — لا حاجة لإعادة التوليد"
    return 0
  fi

  step "توليد مقاسات الأيقونة..."
  mkdir -p "$ICONS_DIR"

  if has_cmd convert; then
    for SIZE in 16 24 32 48 64 96 128 256 512 1024; do
      convert "$ICON_SRC" -resize ${SIZE}x${SIZE}^ \
        -gravity center -extent ${SIZE}x${SIZE} \
        "$ICONS_DIR/${SIZE}x${SIZE}.png" 2>/dev/null && \
        printf "  ${GRN}✓${NC} ${SIZE}×${SIZE}\n"
    done
    ok "تم توليد الأيقونات → $ICONS_DIR"
  elif has_cmd ffmpeg; then
    for SIZE in 16 32 48 64 128 256 512; do
      ffmpeg -i "$ICON_SRC" -vf "scale=${SIZE}:${SIZE}" \
        "$ICONS_DIR/${SIZE}x${SIZE}.png" -y -loglevel quiet 2>/dev/null
    done
    ok "تم توليد الأيقونات (ffmpeg)"
  else
    wrn "ImageMagick غير متوفر — نسخ الأيقونة الأصلية بدلاً من تحجيمها"
    for SIZE in 16 32 48 64 128 256 512; do
      cp "$ICON_SRC" "$ICONS_DIR/${SIZE}x${SIZE}.png"
    done
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
#  بناء تطبيق React (يتخطى إذا dist/ أحدث من src/)
# ══════════════════════════════════════════════════════════════════════════════
build_app() {
  step "بناء تطبيق React + TypeScript..."

  # تحقق: هل node_modules موجودة وcomplete؟
  if [ ! -f "$ROOT_DIR/node_modules/.package-lock.json" ] && \
     [ ! -f "$ROOT_DIR/node_modules/.yarn-integrity" ] && \
     [ ! -d "$ROOT_DIR/node_modules/.bin" ]; then
    inf "node_modules غير مكتملة — تشغيل npm install..."
    npm install --prefer-offline 2>&1 | tail -3
  else
    # تحقق من تحديث package.json
    if [ "$ROOT_DIR/package.json" -nt "$ROOT_DIR/node_modules/.package-lock.json" ] 2>/dev/null; then
      inf "package.json تغيّر — تحديث الحزم..."
      npm install --prefer-offline 2>&1 | tail -3
    else
      found "node_modules" "جاهزة"
    fi
  fi

  # تحقق: هل البناء الحالي محدّث؟
  local NEEDS_BUILD=true
  if [ -d "$DIST_DIR" ] && [ -f "$DIST_DIR/index.html" ]; then
    # ابحث عن ملف src أحدث من آخر بناء
    local NEWER
    NEWER=$(find "$ROOT_DIR/src" "$ROOT_DIR/index.html" "$ROOT_DIR/vite.config.ts" \
      "$ROOT_DIR/public/fonts.css" \
      -newer "$DIST_DIR/index.html" 2>/dev/null | head -1)
    if [ -z "$NEWER" ]; then
      found "dist/ (بناء React)" "محدَّث — لا حاجة لإعادة البناء"
      NEEDS_BUILD=false
    else
      inf "ملف تغيّر: $NEWER — إعادة البناء..."
    fi
  fi

  if [ "$NEEDS_BUILD" = true ]; then
    npm run build 2>&1 | grep -E "(✓|error|warning|built in)" || true
    if [ ! -d "$DIST_DIR" ]; then
      err "فشل البناء — مجلد dist/ غير موجود"
      exit 1
    fi
    ok "تم بناء React → $DIST_DIR"
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
#  بناء AppImage + DEB عبر electron-builder
# ══════════════════════════════════════════════════════════════════════════════
build_electron_packages() {
  local TARGETS="${1:-AppImage deb}"
  step "بناء حزم Electron: $TARGETS"

  # تحقق من وجود حزم محدّثة
  local SKIP_BUILD=true
  for T in $TARGETS; do
    local EXT="${T,,}"
    [ "$EXT" = "appimage" ] && EXT="AppImage"
    local EXISTING
    EXISTING=$(find "$RELEASE_DIR" -maxdepth 1 -name "*.${EXT}" 2>/dev/null | head -1)
    if [ -z "$EXISTING" ] || [ "$DIST_DIR/index.html" -nt "$EXISTING" ] 2>/dev/null; then
      SKIP_BUILD=false
      break
    fi
  done

  if [ "$SKIP_BUILD" = true ]; then
    inf "الحزم محدَّثة — تخطّي electron-builder"
    for T in $TARGETS; do
      local EXT="${T,,}"
      [ "$EXT" = "appimage" ] && EXT="AppImage"
      local PKG
      PKG=$(find "$RELEASE_DIR" -maxdepth 1 -name "*.${EXT}" | head -1)
      [ -n "$PKG" ] && found "$EXT" "$(basename "$PKG") ($(du -sh "$PKG" | cut -f1))"
    done
    return 0
  fi

  npx electron-builder --linux $TARGETS 2>&1 | \
    grep -E "(building|built|error|packaging|•|⨯)" || true

  for T in $TARGETS; do
    local EXT="${T,,}"
    [ "$EXT" = "appimage" ] && EXT="AppImage"
    local PKG
    PKG=$(find "$RELEASE_DIR" -maxdepth 1 -name "*.${EXT}" -newer "$DIST_DIR/index.html" 2>/dev/null | head -1)
    if [ -n "$PKG" ]; then
      ok "${EXT}: $(basename "$PKG") ($(du -sh "$PKG" | cut -f1))"
      BUILT+=("$EXT: $(basename "$PKG")")
    else
      # Check if it exists but wasn't rebuilt
      PKG=$(find "$RELEASE_DIR" -maxdepth 1 -name "*.${EXT}" 2>/dev/null | head -1)
      if [ -n "$PKG" ]; then
        wrn "${EXT}: $(basename "$PKG") (لم يُعاد البناء — الملف الحالي محدَّث)"
        BUILT+=("$EXT: $(basename "$PKG")")
      else
        err "${EXT}: فشل البناء"
        FAILED+=("$EXT")
      fi
    fi
  done
}

# ══════════════════════════════════════════════════════════════════════════════
#  بناء RPM (من DEB — يتجنب مشكلة الأحرف العربية في المسار عبر /tmp)
# ══════════════════════════════════════════════════════════════════════════════
build_rpm() {
  step "بناء حزمة RPM..."

  # تحقق من وجود RPM محدَّث
  local EXISTING_RPM
  EXISTING_RPM=$(find "$RELEASE_DIR" -maxdepth 1 -name "*.rpm" 2>/dev/null | head -1)
  if [ -n "$EXISTING_RPM" ]; then
    local DEB_NEWER
    DEB_NEWER=$(find "$RELEASE_DIR" -maxdepth 1 -name "*.deb" \
      -newer "$EXISTING_RPM" 2>/dev/null | head -1)
    if [ -z "$DEB_NEWER" ]; then
      found "RPM" "$(basename "$EXISTING_RPM") ($(du -sh "$EXISTING_RPM" | cut -f1)) — محدَّث"
      BUILT+=("RPM: $(basename "$EXISTING_RPM")")
      return 0
    fi
  fi

  # تأكد من وجود DEB
  local DEB
  DEB=$(find "$RELEASE_DIR" -maxdepth 1 -name "*.deb" | head -1)
  if [ -z "$DEB" ]; then
    inf "لا يوجد DEB — جاري بناؤه أولاً..."
    build_electron_packages "deb"
    DEB=$(find "$RELEASE_DIR" -maxdepth 1 -name "*.deb" | head -1)
    [ -z "$DEB" ] && { err "فشل بناء DEB"; FAILED+=("RPM"); return 1; }
  fi

  # ── الطريقة 1: rpmbuild (عبر /tmp لتفادي الأحرف العربية في المسار) ──────
  if has_cmd rpmbuild && has_cmd dpkg-deb; then
    inf "استخدام rpmbuild..."
    local WORK=/tmp/gt-md-rpm-build
    rm -rf "$WORK"
    mkdir -p "$WORK"/{SOURCES,SPECS,BUILD,BUILDROOT,RPMS,SRPMS}

    local PKG_DIR="$WORK/pkg"
    mkdir -p "$PKG_DIR"
    dpkg-deb -x "$DEB" "$PKG_DIR" 2>/dev/null || { err "dpkg-deb فشل"; FAILED+=("RPM"); return 1; }

    tar czf "$WORK/SOURCES/${APP_NAME}-${VERSION}.tar.gz" \
      -C "$PKG_DIR" --transform "s|^\./|${APP_NAME}-${VERSION}/|" . 2>/dev/null

    cat > "$WORK/SPECS/${APP_NAME}.spec" << SPEC
%global _unpackaged_files_terminate_build 0
%global __os_install_post %{nil}
Name:           ${APP_NAME}
Version:        ${VERSION}
Release:        1
Summary:        ${APP_DISPLAY} - Modern Arabic Markdown Editor
License:        GPL-3.0-or-later
URL:            https://github.com/SalehGNUTUX/${APP_DISPLAY}
BuildArch:      x86_64
AutoReqProv:    no
Source0:        ${APP_NAME}-${VERSION}.tar.gz

%description
${APP_DISPLAY} ${VERSION} - محرر مارك داون عربي عصري
Built with Electron + React + TypeScript. Fully offline.
Supports RTL/LTR, Arabic fonts, KaTeX math, PDF/HTML/MD export.

%prep
%setup -q -c

%install
cp -a "${APP_NAME}-${VERSION}/." %{buildroot}/

%files
%defattr(-,root,root,-)
/opt/GT-MARKDAWIN
%dir /usr/share/applications
/usr/share/applications/gt-markdawin.desktop
/usr/share/icons
/usr/share/doc
/usr/share/mime/packages/gt-markdawin.xml

%post
update-desktop-database /usr/share/applications/ 2>/dev/null || true
gtk-update-icon-cache -f -t /usr/share/icons/hicolor/ 2>/dev/null || true

%postun
update-desktop-database /usr/share/applications/ 2>/dev/null || true

%changelog
* $(LC_ALL=C date "+%a %b %d %Y") SalehGNUTUX <gnutux.arabic@gmail.com> - ${VERSION}-1
- ${APP_DISPLAY} ${VERSION} — Electron + React build
SPEC

    rpmbuild --define "_topdir $WORK" -bb "$WORK/SPECS/${APP_NAME}.spec" 2>&1 | tail -5

    local RPM_FILE
    RPM_FILE=$(find "$WORK/RPMS" -name "*.rpm" 2>/dev/null | head -1)
    if [ -n "$RPM_FILE" ]; then
      local DEST="$RELEASE_DIR/${APP_DISPLAY}-${VERSION}-${ARCH}.rpm"
      cp "$RPM_FILE" "$DEST"
      rm -rf "$WORK"
      ok "RPM: $(basename "$DEST") ($(du -sh "$DEST" | cut -f1))"
      BUILT+=("RPM: $(basename "$DEST")")
      return 0
    fi
    wrn "rpmbuild لم ينجح — محاولة alien..."
  fi

  # ── الطريقة 2: alien (DEB → RPM) ──────────────────────────────────────────
  if has_cmd alien; then
    inf "استخدام alien (DEB→RPM)..."
    local TMP_DIR
    TMP_DIR=$(mktemp -d /tmp/gt-alien-XXXX)
    cp "$DEB" "$TMP_DIR/"
    cd "$TMP_DIR"
    rm -rf "${APP_NAME}-"*/ 2>/dev/null || true

    # توليد الملفات وإصلاح Summary الفارغ
    fakeroot alien --generate "$(basename "$DEB")" 2>/dev/null || true
    local SPEC_FILE
    SPEC_FILE=$(find "$TMP_DIR" -name "*.spec" 2>/dev/null | head -1)
    if [ -n "$SPEC_FILE" ]; then
      sed -i "s|^Summary:[[:space:]]*$|Summary: ${APP_DISPLAY} - Modern Arabic Markdown Editor|" "$SPEC_FILE"
    fi
    fakeroot alien --to-rpm --scripts "$(basename "$DEB")" 2>&1 | tail -3

    local RPM_FILE
    RPM_FILE=$(find "$TMP_DIR" -name "*.rpm" 2>/dev/null | head -1)
    cd "$ROOT_DIR"
    if [ -n "$RPM_FILE" ]; then
      local DEST="$RELEASE_DIR/${APP_DISPLAY}-${VERSION}-${ARCH}.rpm"
      cp "$RPM_FILE" "$DEST"
      rm -rf "$TMP_DIR"
      ok "RPM: $(basename "$DEST") ($(du -sh "$DEST" | cut -f1))"
      BUILT+=("RPM: $(basename "$DEST")")
      return 0
    fi
    rm -rf "$TMP_DIR"
  fi

  # آخر محاولة: هل يوجد RPM من بناء سابق؟
  local OLD_RPM
  OLD_RPM=$(find "$RELEASE_DIR" -maxdepth 1 -name "*.rpm" 2>/dev/null | head -1)
  if [ -n "$OLD_RPM" ]; then
    wrn "استخدام RPM من بناء سابق: $(basename "$OLD_RPM")"
    BUILT+=("RPM (قديم): $(basename "$OLD_RPM")")
  else
    err "تعذّر بناء RPM — ثبّت: rpmbuild (rpm-build) أو alien"
    FAILED+=("RPM")
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
#  بناء Flatpak
# ══════════════════════════════════════════════════════════════════════════════
build_flatpak() {
  step "بناء حزمة Flatpak..."

  if ! has_cmd flatpak-builder; then
    err "flatpak-builder غير موجود"
    inf "التثبيت:"
    inf "  Debian/Ubuntu: sudo apt install flatpak-builder flatpak"
    inf "  Fedora:        sudo dnf install flatpak-builder"
    inf "  ثم: flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo"
    inf "  ثم: flatpak install flathub org.electronjs.Electron2.BaseApp//24.08"
    FAILED+=("Flatpak"); return 1
  fi

  local FLATPAK_OUT="$RELEASE_DIR/${APP_DISPLAY}-${VERSION}.flatpak"

  # تحقق من وجود حزمة محدَّثة
  if [ -f "$FLATPAK_OUT" ] && [ "$DIST_DIR/index.html" -ot "$FLATPAK_OUT" ] 2>/dev/null; then
    found "Flatpak" "$(basename "$FLATPAK_OUT") (محدَّث)"
    BUILT+=("Flatpak: $(basename "$FLATPAK_OUT")")
    return 0
  fi

  local FLATPAK_BUILD="$RELEASE_DIR/flatpak-build"
  local FLATPAK_REPO="$RELEASE_DIR/flatpak-repo"
  mkdir -p "$FLATPAK_BUILD" "$FLATPAK_REPO"

  flatpak-builder --force-clean --repo="$FLATPAK_REPO" \
    "$FLATPAK_BUILD" \
    "$ROOT_DIR/flatpak/com.gnutux.GTMarkdaWin.yml" 2>&1 | tail -10

  flatpak build-bundle "$FLATPAK_REPO" "$FLATPAK_OUT" com.gnutux.GTMarkdaWin 2>&1 | tail -5

  if [ -f "$FLATPAK_OUT" ]; then
    ok "Flatpak: $(basename "$FLATPAK_OUT") ($(du -sh "$FLATPAK_OUT" | cut -f1))"
    BUILT+=("Flatpak: $(basename "$FLATPAK_OUT")")
  else
    err "فشل بناء Flatpak"
    FAILED+=("Flatpak")
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
#  بناء APK أندرويد
# ══════════════════════════════════════════════════════════════════════════════
build_apk() {
  step "بناء APK أندرويد..."

  if [ ! -f "$ANDROID_DIR/gradlew" ]; then
    err "مجلد android/ غير موجود — شغّل: npx cap add android"
    FAILED+=("APK"); return 1
  fi

  # تحقق من Android SDK
  local SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
  if [ ! -d "$SDK_DIR" ]; then
    wrn "Android SDK غير موجود في $SDK_DIR"
    inf "عليك تثبيت Android Studio أو SDK command-line tools:"
    inf "  https://developer.android.com/studio#command-tools"
    inf "  ثم: export ANDROID_HOME=\$HOME/Android/Sdk"
    FAILED+=("APK"); return 1
  fi
  export ANDROID_HOME="$SDK_DIR"
  export ANDROID_SDK_ROOT="$SDK_DIR"

  # تحقق من وجود APK محدَّث
  local EXISTING_APK
  EXISTING_APK=$(find "$RELEASE_DIR/android" -name "*.apk" 2>/dev/null | head -1)
  if [ -n "$EXISTING_APK" ] && [ "$DIST_DIR/index.html" -ot "$EXISTING_APK" ] 2>/dev/null; then
    found "APK" "$(basename "$EXISTING_APK") ($(du -sh "$EXISTING_APK" | cut -f1)) — محدَّث"
    BUILT+=("APK: $(basename "$EXISTING_APK")")
    return 0
  fi

  # مزامنة Capacitor
  inf "مزامنة Capacitor..."
  npx cap sync android 2>&1 | grep -E "(Sync|error|update)" || true

  chmod +x "$ANDROID_DIR/gradlew"
  cd "$ANDROID_DIR"

  # حاول release أولاً ثم debug
  inf "بناء Release APK..."
  if ./gradlew assembleRelease 2>&1 | tail -8 && \
     APK_FILE=$(find "$ANDROID_DIR/app/build/outputs/apk/release" -name "*.apk" 2>/dev/null | head -1) && \
     [ -n "$APK_FILE" ]; then
    cd "$ROOT_DIR"
    mkdir -p "$RELEASE_DIR/android"
    cp "$APK_FILE" "$RELEASE_DIR/android/${APP_DISPLAY}-${VERSION}.apk"
    ok "APK: ${APP_DISPLAY}-${VERSION}.apk ($(du -sh "$RELEASE_DIR/android/${APP_DISPLAY}-${VERSION}.apk" | cut -f1))"
    BUILT+=("APK: ${APP_DISPLAY}-${VERSION}.apk")
  else
    inf "محاولة Debug APK..."
    ./gradlew assembleDebug 2>&1 | tail -5
    APK_FILE=$(find "$ANDROID_DIR/app/build/outputs/apk/debug" -name "*.apk" 2>/dev/null | head -1)
    cd "$ROOT_DIR"
    if [ -n "$APK_FILE" ]; then
      mkdir -p "$RELEASE_DIR/android"
      cp "$APK_FILE" "$RELEASE_DIR/android/${APP_DISPLAY}-${VERSION}-debug.apk"
      ok "APK (debug): ${APP_DISPLAY}-${VERSION}-debug.apk"
      BUILT+=("APK-debug: ${APP_DISPLAY}-${VERSION}-debug.apk")
    else
      err "فشل بناء APK"
      FAILED+=("APK")
    fi
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
#  التقرير النهائي
# ══════════════════════════════════════════════════════════════════════════════
print_report() {
  echo ""
  echo -e "${BLU}══════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLU}  تقرير البناء النهائي${NC}"
  echo -e "${BLU}══════════════════════════════════════════════════════════════${NC}"

  if [ ${#PKGS_INSTALLED[@]} -gt 0 ]; then
    echo -e "${CYN}  ↓ حزم جديدة ثُبِّتت: ${PKGS_INSTALLED[*]}${NC}"
  fi

  if [ ${#BUILT[@]} -gt 0 ]; then
    echo -e "${GRN}  ✅ تم بنجاح:${NC}"
    for b in "${BUILT[@]}"; do echo "     • $b"; done
  fi

  if [ ${#FAILED[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}  ❌ فشل:${NC}"
    for f in "${FAILED[@]}"; do echo "     • $f"; done
  fi

  echo ""
  echo -e "${GRY}  📁 ملفات الإصدار في: $RELEASE_DIR${NC}"
  find "$RELEASE_DIR" -maxdepth 2 \
    \( -name "*.AppImage" -o -name "*.deb" -o -name "*.rpm" \
       -o -name "*.apk" -o -name "*.flatpak" \) \
    2>/dev/null | sort | while read -r F; do
      printf "     ${GRN}%-8s${NC}  %s\n" "$(du -sh "$F" | cut -f1)" "$(basename "$F")"
    done

  echo ""
  echo -e "${YLW}  📋 التثبيت:${NC}"
  echo "     AppImage → chmod +x *.AppImage && ./*.AppImage"
  echo "     DEB      → sudo dpkg -i *.deb"
  echo "     RPM      → sudo rpm -i *.rpm  (أو: sudo dnf localinstall)"
  echo "     Flatpak  → flatpak install --user *.flatpak"
  echo "     APK      → adb install release/android/*.apk"
  echo ""
  echo -e "${BLU}══════════════════════════════════════════════════════════════${NC}"
}

# ══════════════════════════════════════════════════════════════════════════════
#  نقطة الدخول الرئيسية
# ══════════════════════════════════════════════════════════════════════════════
TARGET="${1:-all}"

case "$TARGET" in

check-deps)
  run_checks "all"
  ;;

install-deps)
  run_checks "all"
  install_missing
  ;;

icons)
  generate_icons
  ;;

build)
  ensure_deps "build"
  build_app
  ;;

appimage)
  ensure_deps "appimage"
  generate_icons
  build_app
  build_electron_packages "AppImage"
  print_report
  ;;

deb)
  ensure_deps "deb"
  generate_icons
  build_app
  build_electron_packages "deb"
  print_report
  ;;

rpm)
  ensure_deps "rpm"
  build_rpm
  print_report
  ;;

flatpak)
  ensure_deps "flatpak"
  build_app
  build_flatpak
  print_report
  ;;

apk)
  ensure_deps "apk"
  build_app
  build_apk
  print_report
  ;;

linux)
  ensure_deps "linux"
  generate_icons
  build_app
  build_electron_packages "AppImage deb"
  build_rpm
  print_report
  ;;

all)
  ensure_deps "all"
  generate_icons
  build_app
  build_electron_packages "AppImage deb"
  build_rpm
  build_flatpak
  build_apk
  print_report
  ;;

-h|--help|help)
  echo ""
  echo -e "${BLU}الاستخدام: $0 [هدف]${NC}"
  echo ""
  echo -e "${YLW}أهداف Linux:${NC}"
  echo "  linux        ← AppImage + DEB + RPM (الأكثر استخداماً)"
  echo "  appimage     ← AppImage فقط"
  echo "  deb          ← حزمة DEB (Ubuntu/Debian)"
  echo "  rpm          ← حزمة RPM (Fedora/RHEL)"
  echo "  flatpak      ← حزمة Flatpak"
  echo ""
  echo -e "${YLW}أهداف Android:${NC}"
  echo "  apk          ← APK أندرويد (يحتاج Android SDK)"
  echo ""
  echo -e "${YLW}متنوع:${NC}"
  echo "  all          ← كل الحزم (Linux + Android)"
  echo "  build        ← بناء React/Vite فقط"
  echo "  icons        ← (إعادة) توليد مقاسات الأيقونة"
  echo "  check-deps   ← فحص المتطلبات (بدون تثبيت)"
  echo "  install-deps ← تثبيت المتطلبات المفقودة فقط"
  echo ""
  echo -e "${GRY}ملاحظة: السكريبت يكتشف ما هو مثبّت مسبقاً ولا يُعيد تثبيته.${NC}"
  echo ""
  ;;

*)
  err "هدف غير معروف: $TARGET"
  echo "شغّل: $0 --help"
  exit 1
  ;;

esac
