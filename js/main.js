/**
 * main.js — 롯데호텔 서울(더그랜드롯데) 홈페이지 클론
 * 네비바 / 메인 히어로 / Location / 푸터 상호작용 및 반응형 동작
 * (원본 사이트는 React 번들로 동작하지만, 이 클론은 순수 vanilla JS로 재구현)
 */
(function () {
  "use strict";

  /* ---------------------------------------------------------
   * 1. 헤더 스크롤 상태 (#header.on)
   * ------------------------------------------------------- */
  var header = document.getElementById("header");
  function updateHeaderScrollState() {
    if (!header) return;
    if (window.scrollY > 10) header.classList.add("on");
    else header.classList.remove("on");
  }
  window.addEventListener("scroll", updateHeaderScrollState, { passive: true });
  updateHeaderScrollState();

  /* ---------------------------------------------------------
   * 2. GNB 메가메뉴 드롭다운은 사용하지 않음
   *    (PC 헤더 로고와 겹쳐서 hover-open 동작 자체를 제거 — 상단 메뉴는 단순 링크로만 사용)
   * ------------------------------------------------------- */

  /* ---------------------------------------------------------
   * 3. 햄버거 전체메뉴 (모바일 오버레이)
   * ------------------------------------------------------- */
  var allmenuWrap = document.querySelector(".header-allmenu-wrap");
  var hamburgerBtn = document.querySelector(".btn-hamburger");
  var closeBtn = document.querySelector(".btn-header-allmenu-close");
  var dimmed = document.querySelector(".header-allmenu-wrap .dimmed");

  function openAllMenu() {
    if (!allmenuWrap) return;
    allmenuWrap.classList.add("is-open");
    document.body.classList.add("menu-open");
  }
  function closeAllMenu() {
    if (!allmenuWrap) return;
    allmenuWrap.classList.remove("is-open");
    document.body.classList.remove("menu-open");
  }
  if (hamburgerBtn) hamburgerBtn.addEventListener("click", openAllMenu);
  if (closeBtn) closeBtn.addEventListener("click", closeAllMenu);
  if (dimmed) dimmed.addEventListener("click", closeAllMenu);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAllMenu();
  });

  /* ---------------------------------------------------------
   * 4. 언어 / 통화 선택 콤보박스
   * ------------------------------------------------------- */
  document.querySelectorAll(".component-select .select-field").forEach(function (field) {
    var combo = field.querySelector(".select-combobox");
    var options = field.querySelector(".select-options");
    var dimm = field.querySelector(".dimm");
    if (!combo || !options) return;

    function open() {
      field.classList.add("is-open");
      combo.setAttribute("aria-expanded", "true");
      options.style.display = "block";
      if (dimm) dimm.style.display = "block";
    }
    function close() {
      field.classList.remove("is-open");
      combo.setAttribute("aria-expanded", "false");
      options.style.display = "none";
      if (dimm) dimm.style.display = "none";
    }
    combo.addEventListener("click", function () {
      field.classList.contains("is-open") ? close() : open();
    });
    if (dimm) dimm.addEventListener("click", close);
    options.querySelectorAll(".option").forEach(function (opt) {
      opt.addEventListener("click", function () {
        options.querySelectorAll(".option").forEach(function (o) {
          o.setAttribute("aria-selected", "false");
          o.classList.remove("current");
        });
        opt.setAttribute("aria-selected", "true");
        opt.classList.add("current");
        combo.querySelector("span").textContent = opt.getAttribute("data-selecttext") || opt.textContent.trim();
        field.setAttribute("data-selected", opt.getAttribute("data-value") || "");
        close();
      });
    });
  });

  /* ---------------------------------------------------------
   * 5. 푸터 아코디언 (모바일 DESTINATION/COMPANY/... 접기·펼치기)
   * ------------------------------------------------------- */
  document.querySelectorAll(".component-accordion .accordion-item").forEach(function (item) {
    var btn = item.querySelector(".accordion-btn");
    var content = item.querySelector(".accordion-content");
    if (!btn || !content) return;
    btn.addEventListener("click", function () {
      var isOpen = item.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(isOpen));
      content.setAttribute("aria-hidden", String(!isOpen));
    });
  });

  /* ---------------------------------------------------------
   * 6. 푸터 Family Site 콜랩스
   * ------------------------------------------------------- */
  document.querySelectorAll(".component-collapse").forEach(function (box) {
    var btn = box.querySelector(".collapse-tit");
    var content = box.querySelector(".collapse-content");
    if (!btn || !content) return;
    btn.addEventListener("click", function () {
      var opened = box.getAttribute("data-state") === "open";
      box.setAttribute("data-state", opened ? "close" : "open");
      btn.setAttribute("aria-expanded", String(!opened));
      content.setAttribute("aria-hidden", String(opened));
    });
  });

  /* ---------------------------------------------------------
   * 7. 주소 복사 버튼
   * ------------------------------------------------------- */
  document.querySelectorAll(".btn-copy").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy-text") || "";
      var done = function () {
        btn.classList.add("copied");
        setTimeout(function () { btn.classList.remove("copied"); }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(done);
      } else {
        done();
      }
    });
  });

  /* ---------------------------------------------------------
   * 8. 메인 히어로 스와이퍼 (component-swiper.swiper-main-kv)
   * ------------------------------------------------------- */
  (function initHeroSwiper() {
    var root = document.querySelector(".chain-lottehotel-main-kv-swiper");
    if (!root) return;
    var wrapper = root.querySelector(".swiper-wrapper");
    var slides = Array.prototype.slice.call(root.querySelectorAll(".swiper-slide"));
    if (!wrapper || slides.length === 0) return;

    var videoEl = root.querySelector("#heroVideo");
    var videoSlideIndex = slides.findIndex(function (s) { return s.classList.contains("swiper-slide-video"); });

    var current = slides.findIndex(function (s) { return s.classList.contains("swiper-slide-active"); });
    if (current < 0) current = 0;

    var total = slides.length;
    var currentEl = root.querySelector(".swiper-pagination-current");
    var totalEl = root.querySelector(".swiper-pagination-total");
    var progressInner = root.querySelector(".swiper-progressbar-inner");
    var prevBtn = root.querySelector(".swiper-button-prev");
    var nextBtn = root.querySelector(".swiper-button-next");
    var stopBtn = root.querySelector(".btn-stop");
    var AUTOPLAY_MS = 5000;
    var timer = null;
    var playing = true;

    if (totalEl) totalEl.textContent = String(total);

    function isVideoSlide(i) { return i === videoSlideIndex; }

    function render(instant) {
      slides.forEach(function (s, i) {
        s.classList.toggle("swiper-slide-active", i === current);
        s.classList.toggle("swiper-slide-fully-visible", i === current);
        s.setAttribute("aria-hidden", i === current ? "false" : "true");
        s.setAttribute("tabindex", i === current ? "0" : "-1");
      });
      // 마지막 슬라이드 → 영상(처음)으로 순환할 때: 트랜지션을 타면 전체 슬라이드를
      // 역방향으로 훑고 지나가는 것처럼 보이므로, 이 구간만 트랜지션 없이 즉시 전환
      if (instant) wrapper.style.transition = "none";
      wrapper.style.transform = "translate3d(" + (-current * 100) + "%, 0, 0)";
      if (instant) {
        // eslint-disable-next-line no-unused-expressions
        wrapper.offsetHeight; /* force reflow so transition:none applies before we restore it */
        wrapper.style.transition = "transform .5s ease";
      }
      if (currentEl) currentEl.textContent = String(current + 1);
    }

    function onVideoEnded() { next(); }
    function onVideoTimeUpdate() {
      if (progressInner && videoEl.duration) {
        progressInner.style.transition = "none";
        progressInner.style.width = (videoEl.currentTime / videoEl.duration * 100) + "%";
      }
    }
    function detachVideoListeners() {
      if (!videoEl) return;
      videoEl.removeEventListener("ended", onVideoEnded);
      videoEl.removeEventListener("timeupdate", onVideoTimeUpdate);
    }

    function restartProgress() {
      if (!progressInner) return;
      progressInner.style.transition = "none";
      progressInner.style.width = "0%";
      // eslint-disable-next-line no-unused-expressions
      progressInner.offsetHeight; /* force reflow */
      if (playing) {
        progressInner.style.transition = "width " + AUTOPLAY_MS + "ms linear";
        progressInner.style.width = "100%";
      }
    }

    // 슬라이드가 바뀔 때마다: 영상 슬라이드면 영상 재생 후 ended 이벤트로 다음 슬라이드 진행,
    // 일반 이미지 슬라이드면 기존처럼 타이머 기반 자동 넘김
    function scheduleAdvance() {
      clearInterval(timer);
      detachVideoListeners();
      if (videoEl) videoEl.pause();

      if (!playing) return;

      if (isVideoSlide(current) && videoEl) {
        try { videoEl.currentTime = 0; } catch (e) {}
        videoEl.addEventListener("ended", onVideoEnded);
        videoEl.addEventListener("timeupdate", onVideoTimeUpdate);
        if (progressInner) { progressInner.style.transition = "none"; progressInner.style.width = "0%"; }
        var p = videoEl.play();
        if (p && p.catch) p.catch(function () { /* 자동재생 실패 시 무시하고 넘어감 */ });
      } else {
        restartProgress();
        timer = setInterval(next, AUTOPLAY_MS);
      }
    }

    function goTo(index, instant) {
      current = (index + total) % total;
      render(instant);
      scheduleAdvance();
    }
    function next() { goTo(current + 1, current === total - 1); }
    function prev() { goTo(current - 1, current === 0); }

    function play() {
      playing = true;
      if (stopBtn) {
        stopBtn.classList.add("isplay");
        stopBtn.querySelector(".hide-txt").textContent = "자동 슬라이드 일시 정지";
      }
      scheduleAdvance();
    }
    function pause() {
      playing = false;
      if (stopBtn) {
        stopBtn.classList.remove("isplay");
        stopBtn.querySelector(".hide-txt").textContent = "자동 슬라이드 재생";
      }
      clearInterval(timer);
      detachVideoListeners();
      if (videoEl) videoEl.pause();
      if (progressInner) progressInner.style.transition = "none";
    }

    if (nextBtn) nextBtn.addEventListener("click", function () { next(); if (playing) play(); });
    if (prevBtn) prevBtn.addEventListener("click", function () { prev(); if (playing) play(); });
    if (stopBtn) stopBtn.addEventListener("click", function () { playing ? pause() : play(); });

    wrapper.style.display = "flex";
    wrapper.style.transition = "transform .5s ease";
    slides.forEach(function (s) { s.style.flex = "0 0 100%"; s.style.width = "100%"; });

    render();
    play();
  })();

  /* ---------------------------------------------------------
   * 9. 푸터 브랜드 로고 스와이퍼 (component-swiper.swiper-footer)
   * ------------------------------------------------------- */
  (function initFooterSwiper() {
    var root = document.querySelector(".swiper-footer");
    if (!root) return;
    var wrapper = root.querySelector(".swiper-wrapper");
    var slides = Array.prototype.slice.call(root.querySelectorAll(".swiper-slide"));
    var prevBtn = root.querySelector(".swiper-button-prev");
    var nextBtn = root.querySelector(".swiper-button-next");
    if (!wrapper || slides.length === 0) return;

    var visibleCount = 5;
    function calcVisibleCount() {
      visibleCount = window.innerWidth < 768 ? 2 : window.innerWidth < 1200 ? 4 : 6;
    }
    calcVisibleCount();
    window.addEventListener("resize", calcVisibleCount);

    var start = 0;
    slides.forEach(function (s) {
      s.style.flex = "0 0 auto";
      s.style.width = "14rem";
    });
    wrapper.style.display = "flex";
    wrapper.style.transition = "transform .4s ease";

    function render() {
      var slideWidth = slides[0].getBoundingClientRect().width || 140;
      wrapper.style.transform = "translate3d(" + (-start * slideWidth) + "px,0,0)";
    }
    if (nextBtn) nextBtn.addEventListener("click", function () {
      start = Math.min(start + 1, Math.max(0, slides.length - visibleCount));
      render();
    });
    if (prevBtn) prevBtn.addEventListener("click", function () {
      start = Math.max(start - 1, 0);
      render();
    });
    window.addEventListener("resize", render);
    render();
  })();

  /* ---------------------------------------------------------
   * 10. 플로팅 퀵 버튼 노출 (히어로 영역을 지나면 표시)
   *     원본의 btn-reserve(예약하기)를 로그인 페이지 진입 버튼으로 재구성
   *     + 전화 문의(tel:) / 카카오톡 상담 버튼도 같은 wrap에 있어 함께 표시/숨김됨
   *     (히어로가 없는 페이지는 kv가 없어 스크롤 300px 기준으로 표시)
   *     wrap의 display는 항상 flex(세로 정렬) — 노출/숨김은 is-visible 클래스의
   *     opacity/visibility로만 전환한다 (예전엔 style.display를 block↔none으로
   *     직접 바꿔서, 위로 다시 스크롤했을 때 display:block인 채로 안 지워지고
   *     버튼들이 옆으로 나란히 보이는 버그가 있었음)
   * ------------------------------------------------------- */
  (function initLoginFab() {
    var fabWrap = document.getElementById("reservationFixedWrap");
    var fabBtn = document.getElementById("loginFabBtn");
    var kv = document.querySelector(".chain-ma-kv");
    if (!fabWrap) return;

    function toggle() {
      var showAfter = kv ? kv.getBoundingClientRect().bottom : 300;
      fabWrap.classList.toggle("is-visible", window.scrollY > Math.max(showAfter, 200));
    }
    window.addEventListener("scroll", toggle, { passive: true });
    toggle();

    if (fabBtn) {
      fabBtn.addEventListener("click", function () {
        window.location.href = "login.html";
      });
    }
  })();

  /* ---------------------------------------------------------
   * 11. Location 섹션 현지 시각 실시간 갱신
   * ------------------------------------------------------- */
  (function initLocalClock() {
    var el = document.getElementById("localTimeText");
    if (!el) return;
    function fmt() {
      var d = new Date();
      var y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
      var h = d.getHours(), min = d.getMinutes();
      var ampm = h < 12 ? "오전" : "오후";
      var h12 = h % 12 === 0 ? 12 : h % 12;
      var mm = (min < 10 ? "0" : "") + min;
      el.textContent = y + "년 " + m + "월 " + day + "일 " + ampm + " " + h12 + ":" + mm;
    }
    fmt();
    setInterval(fmt, 30000);
  })();

  /* ---------------------------------------------------------
   * 12. 공지사항 세로 스와이퍼 (swiper-main-notice)
   * ------------------------------------------------------- */
  (function initNoticeSwiper() {
    var root = document.querySelector(".swiper-main-notice");
    if (!root) return;
    var wrapper = root.querySelector(".swiper-wrapper");
    var slides = Array.prototype.slice.call(root.querySelectorAll(".swiper-slide"));
    if (!wrapper || slides.length === 0) return;

    var current = slides.findIndex(function (s) { return s.classList.contains("swiper-slide-active"); });
    if (current < 0) current = 0;
    var total = slides.length;
    var currentEl = root.querySelector(".swiper-pagination-current");
    var totalEl = root.querySelector(".swiper-pagination-total");
    var prevBtn = root.querySelector(".swiper-button-prev");
    var nextBtn = root.querySelector(".swiper-button-next");
    var stopBtn = root.querySelector(".btn-stop");
    var AUTOPLAY_MS = 4000;
    var timer = null;
    var playing = true;

    if (totalEl) totalEl.textContent = String(total);
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.transition = "transform .4s ease";
    slides.forEach(function (s) { s.style.flex = "0 0 100%"; });

    function render() {
      slides.forEach(function (s, i) {
        s.classList.toggle("swiper-slide-active", i === current);
        s.setAttribute("aria-hidden", i === current ? "false" : "true");
      });
      wrapper.style.transform = "translate3d(0," + (-current * 100) + "%,0)";
      if (currentEl) currentEl.textContent = String(current + 1);
    }
    function goTo(i) { current = (i + total) % total; render(); }
    function next() { goTo(current + 1); }
    function prev() { goTo(current - 1); }
    function play() {
      playing = true;
      if (stopBtn) stopBtn.classList.add("isplay");
      clearInterval(timer);
      timer = setInterval(next, AUTOPLAY_MS);
    }
    function pause() {
      playing = false;
      if (stopBtn) stopBtn.classList.remove("isplay");
      clearInterval(timer);
    }
    if (nextBtn) nextBtn.addEventListener("click", function () { next(); if (playing) play(); });
    if (prevBtn) prevBtn.addEventListener("click", function () { prev(); if (playing) play(); });
    if (stopBtn) stopBtn.addEventListener("click", function () { playing ? pause() : play(); });

    render();
    play();
  })();

  /* ---------------------------------------------------------
   * 13. Featured 텍스트/이미지 듀얼 스와이퍼 (swiper-chain-main-unique_2)
   *     (슬라이드가 1장뿐이라 현재는 정적 표시 — 슬라이드가 여러 장이 되면
   *      두 스와이퍼를 동기화해 자동으로 넘어가도록 구성)
   * ------------------------------------------------------- */
  (function initFeaturedSwiper() {
    var root = document.querySelector(".swiper-chain-main-unique_2");
    if (!root) return;
    var txtSlides = root.querySelectorAll(".swiper-txt-container .swiper-slide");
    var imgSlides = root.querySelectorAll(".swiper-img-container .swiper-slide");
    if (txtSlides.length <= 1) return; // 슬라이드 1장뿐이면 넘길 필요 없음

    var current = 0;
    function render() {
      txtSlides.forEach(function (s, i) { s.style.display = i === current ? "block" : "none"; });
      imgSlides.forEach(function (s, i) { s.style.display = i === current ? "block" : "none"; });
    }
    setInterval(function () {
      current = (current + 1) % txtSlides.length;
      render();
    }, 5000);
  })();

  /* ---------------------------------------------------------
   * 14. 다이닝 카드 스와이퍼 (swiper-type-dining) + 칩 필터
   * ------------------------------------------------------- */
  (function initDiningSwiper() {
    var root = document.querySelector(".swiper-type-dining");
    if (!root) return;
    var wrapper = root.querySelector(".swiper-wrapper");
    if (!wrapper) return;

    var prevBtn = root.querySelector(".swiper-button-prev");
    var nextBtn = root.querySelector(".swiper-button-next");
    var progressInner = root.querySelector(".swiper-progressbar-inner");
    var currentEl = root.querySelector(".swiper-pagination-current");
    var totalEl = root.querySelector(".swiper-pagination-total");

    // 다이닝(기존 카드)과 부대시설(새 카드) 두 세트를 칩 클릭에 따라 통째로 교체
    var diningHTML = wrapper.innerHTML;
    var facilityTemplate = document.getElementById("facilityCardsTemplate");
    var facilityHTML = facilityTemplate ? facilityTemplate.innerHTML : "";

    var slides = [];
    var perView = 3;
    var gapPx = 28;
    var start = 0;
    var maxStart = 0;

    wrapper.style.display = "flex";
    wrapper.style.transition = "transform .4s ease";

    function calcPerView() {
      // 모바일에서 perView를 정확히 1로 주면 카드가 뷰포트를 꽉 채워서 옆에 카드가 더
      // 있다는 걸 알 수 없었음 — 1.15로 줘서 다음 카드가 살짝 보이게(peek) 함
      perView = window.innerWidth < 768 ? 1.15 : window.innerWidth < 1100 ? 2 : 3;
      gapPx = window.innerWidth < 768 ? 16 : 28;
      // flex-basis를 퍼센트로만 주면 margin-right(px)만큼 매번 컨테이너 폭을 초과해서
      // 마지막 카드가 잘려 보이는 문제가 있었음 — margin 총량을 뺀 calc()로 정확히 계산
      var totalGap = gapPx * (perView - 1);
      var basis = "calc((100% - " + totalGap + "px) / " + perView + ")";
      slides.forEach(function (s, i) {
        s.style.flex = "0 0 " + basis;
        s.style.width = basis;
        s.style.marginRight = (i === slides.length - 1) ? "0px" : gapPx + "px";
      });
    }

    function render() {
      if (!slides.length) return;
      maxStart = Math.max(0, slides.length - perView);
      start = Math.min(start, maxStart);
      var slideBox = slides[0].getBoundingClientRect();
      var step = slideBox.width + gapPx;
      wrapper.style.transform = "translate3d(" + (-start * step) + "px,0,0)";
      if (progressInner) {
        var pct = maxStart === 0 ? 100 : ((start / maxStart) * 66.7 + 33.3);
        progressInner.style.width = pct + "%";
      }
      if (currentEl) currentEl.textContent = String(start + 1);
      if (totalEl) totalEl.textContent = String(slides.length);
      if (prevBtn) prevBtn.disabled = start <= 0;
      if (nextBtn) nextBtn.disabled = start >= maxStart;
    }

    function setDataset(html) {
      wrapper.innerHTML = html;
      slides = Array.prototype.slice.call(root.querySelectorAll(".swiper-slide"));
      start = 0;
      calcPerView();
      render();
    }

    if (nextBtn) nextBtn.addEventListener("click", function () { start = Math.min(start + 1, maxStart); render(); });
    if (prevBtn) prevBtn.addEventListener("click", function () { start = Math.max(start - 1, 0); render(); });
    window.addEventListener("resize", function () { calcPerView(); render(); });

    setDataset(diningHTML);

    // 칩 필터 (다이닝/부대시설) — 클릭한 카테고리의 카드 세트로 실제 교체
    document.querySelectorAll(".component-chips .component-chip-btn").forEach(function (chip) {
      var btn = chip.querySelector(".chip-btn");
      if (!btn) return;
      btn.addEventListener("click", function () {
        chip.parentNode.querySelectorAll(".component-chip-btn").forEach(function (c) {
          c.classList.remove("on");
          var b = c.querySelector(".chip-btn");
          if (b) b.setAttribute("aria-pressed", "false");
        });
        chip.classList.add("on");
        btn.setAttribute("aria-pressed", "true");

        var name = btn.getAttribute("data-name");
        if (name === "facilities" && facilityHTML) {
          setDataset(facilityHTML);
        } else if (name === "dining") {
          setDataset(diningHTML);
        }
      });
    });
  })();

  /* ---------------------------------------------------------
   * 15. 플로팅 "상단으로 이동" 버튼
   * ------------------------------------------------------- */
  (function initBackToTop() {
    var btn = document.querySelector(".btn-top");
    if (!btn) return;
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  })();

  /* ---------------------------------------------------------
   * 16. features.html 엘리베이터 버튼 패널
   * (섹션 오피스 / 제조형 카드를 누르면 바로 옆에 층수 버튼이 나타나고,
   *  층수 버튼을 눌러야 그때 실제 상세 페이지로 이동)
   * ------------------------------------------------------- */
  (function initElevatorPanels() {
    var cards = document.querySelectorAll(".feature-select-card[data-floors]");
    if (!cards.length) return;

    // 헤더를 제외한 나머지 화면이 흰색으로 가운데서 양옆으로 퍼지며 덮인 다음 페이지로 이동
    // (푸터는 이 버튼을 누르는 시점엔 화면에 보이는 경우가 거의 없고, 모바일에서는 display:none이라
    //  좌표를 읽으면 0,0,0,0이 나와 높이가 0이 돼버리는 문제가 있었음 — 그래서 푸터는 계산에서 빼고
    //  항상 "헤더 아래 ~ 현재 뷰포트 끝"까지로 단순하게 계산)
    function goToFloorPage(url) {
      var header = document.getElementById("header");
      var headerBottom = header ? header.getBoundingClientRect().bottom : 0;
      var top = Math.max(0, Math.min(headerBottom, window.innerHeight));
      var height = Math.max(0, window.innerHeight - top);

      var backdrop = document.createElement("div");
      backdrop.className = "page-split-backdrop";
      backdrop.style.top = top + "px";
      backdrop.style.height = height + "px";
      document.body.appendChild(backdrop);
      // 강제 리플로우 후 active 클래스를 붙여야 transition이 확실히 재생됨
      backdrop.offsetHeight;
      backdrop.classList.add("active");

      setTimeout(function () {
        window.location.href = url;
      }, 1000);
    }

    // 뒤로가기(bfcache 복원)로 features.html에 다시 왔을 때, 나갈 당시 상태(전환 오버레이,
    // 열려있던 층수 버튼 패널)가 그대로 남아있는 문제 방지 — 페이지가 캐시에서 복원되면 초기화
    window.addEventListener("pageshow", function (e) {
      if (e.persisted) {
        document.querySelectorAll(".page-split-backdrop").forEach(function (el) {
          el.remove();
        });
        closeAll();
      }
    });

    function closeAll(except) {
      document.querySelectorAll(".elevator-panel.open").forEach(function (p) {
        if (p !== except) p.classList.remove("open");
      });
    }

    cards.forEach(function (card) {
      var item = card.closest(".feature-select-item");
      var panel = item ? item.querySelector(".elevator-panel") : null;
      if (!panel) return;

      var floors = card.getAttribute("data-floors").split(",");
      var target = card.getAttribute("data-target");
      var built = false;

      function build() {
        if (built) return;
        built = true;
        floors.forEach(function (floor, i) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "elevator-btn";
          btn.setAttribute("aria-label", floor + "층으로 이동");
          btn.textContent = floor + "F";
          btn.style.animationDelay = (i * 0.03) + "s";
          btn.addEventListener("click", function (e) {
            e.stopPropagation();
            // 예: office.html + 9 -> office-9f.html / manufacturing.html + B1 -> manufacturing-b1f.html
            var page = target.replace(".html", "") + "-" + floor.toLowerCase() + "f.html";
            goToFloorPage(page);
          });
          panel.appendChild(btn);
        });
      }

      card.addEventListener("click", function (e) {
        e.preventDefault();
        build();
        var isOpen = panel.classList.contains("open");
        closeAll(panel);
        panel.classList.toggle("open", !isOpen);
      });
    });

    document.addEventListener("click", function (e) {
      if (!e.target.closest(".feature-select-item")) closeAll();
    });
  })();
})();
