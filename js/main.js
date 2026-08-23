// js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons de forma segura
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    } else {
        console.warn('Los iconos de Lucide no se pudieron cargar.');
    }

    // Año dinámico en footer
    const yearEl = document.getElementById('current-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- Custom Cursor ---
    const cursorDot = document.getElementById('custom-cursor-dot');
    const cursorOutline = document.getElementById('custom-cursor-outline');
    let isHovering = false;

    if (window.matchMedia('(pointer: fine)').matches && !prefersReducedMotion) {
        document.addEventListener('mousemove', (e) => {
            if (cursorDot && cursorOutline) {
                cursorDot.style.opacity = '1';
                cursorOutline.style.opacity = isHovering ? '0.8' : '0.5';
                
                // Fast dot
                cursorDot.style.transform = `translate(${e.clientX - 8}px, ${e.clientY - 8}px) scale(${isHovering ? 0 : 1})`;
                
                // Slower outline with lerp-like behavior (handled via CSS transition and requestAnimationFrame in a full implementation, but simplified here for immediate response)
                cursorOutline.style.transform = `translate(${e.clientX - 24}px, ${e.clientY - 24}px) scale(${isHovering ? 1.5 : 1})`;
                cursorOutline.style.backgroundColor = isHovering ? 'rgba(0, 102, 255, 0.1)' : 'transparent';
            }
        });

        document.querySelectorAll('.interactive-element, a, button, input, select, textarea').forEach(el => {
            el.addEventListener('mouseenter', () => isHovering = true);
            el.addEventListener('mouseleave', () => isHovering = false);
        });

        document.addEventListener('mouseleave', () => {
            if (cursorDot) cursorDot.style.opacity = '0';
            if (cursorOutline) cursorOutline.style.opacity = '0';
        });
    }

    // --- Reveal Animations (Intersection Observer) ---
    if (!prefersReducedMotion) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-revealed');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        document.querySelectorAll('.reveal-element').forEach(el => revealObserver.observe(el));
    } else {
        document.querySelectorAll('.reveal-element').forEach(el => el.classList.add('is-revealed'));
    }

    // --- Parallax Effect ---
    if (!prefersReducedMotion) {
        const heroBg = document.getElementById('hero-bg');
        const heroContent = document.getElementById('hero-content');
        
        const updateParallax = () => {
            const scrollY = window.scrollY;
            if (scrollY < window.innerHeight) {
                if (heroBg) heroBg.style.transform = `scale(${1 + scrollY * 0.0005}) translateY(${scrollY * 0.3}px)`;
                if (heroContent) {
                    heroContent.style.transform = `translateY(${scrollY * 0.4}px)`;
                    heroContent.style.opacity = 1 - (scrollY / (window.innerHeight * 0.8));
                }
            }
            requestAnimationFrame(updateParallax);
        };
        requestAnimationFrame(updateParallax);
    }

    // --- Interactive Map ---
    const mapSection = document.getElementById('map');
    const mapNodes = document.querySelectorAll('.map-node');
    const mapRoutes = document.querySelectorAll('.map-route');
    const mapLocBtns = document.querySelectorAll('.map-loc-btn');
    let mapAnimated = false;

    const activateMapNode = (locId) => {
        // Reset all
        mapLocBtns.forEach(btn => {
            btn.classList.remove('border-[#0066FF]', 'bg-[#0066FF]/10');
            btn.classList.add('glass');
            const dot = btn.querySelector('.loc-dot');
            dot.classList.remove('animate-pulse', 'shadow-[0_0_10px_#0066FF]');
        });
        mapNodes.forEach(node => {
            const label = node.querySelector('.node-label');
            label.classList.remove('border-[#0066FF]', 'text-white');
            label.classList.add('border-white/10', 'text-gray-400');
            
            const ripple = node.querySelector('.node-ripple');
            if (ripple) {
                // If it's the target node, we'll add the custom pulse ring, else remove
                ripple.classList.remove('animate-pulse-ring', 'opacity-100');
            }
        });
        mapRoutes.forEach(route => {
            route.setAttribute('stroke', 'rgba(255,255,255,0.1)');
        });
        document.querySelectorAll('.travel-dot').forEach(dot => {
            dot.style.opacity = '0';
            const anim = dot.querySelector('animateMotion');
            if (anim && anim.endElement) { try { anim.endElement(); } catch (e) {} }
        });

        // Activate target
        if (locId) {
            const targetBtn = document.querySelector(`.map-loc-btn[data-loc="${locId}"]`);
            if (targetBtn) {
                targetBtn.classList.add('border-[#0066FF]', 'bg-[#0066FF]/10');
                targetBtn.classList.remove('glass');
                targetBtn.querySelector('.loc-dot').classList.add('animate-pulse', 'shadow-[0_0_10px_#0066FF]');
            }
            const targetNode = document.querySelector(`.map-node[data-node="${locId}"]`);
            if (targetNode) {
                const label = targetNode.querySelector('.node-label');
                label.classList.add('border-[#0066FF]', 'text-white');
                label.classList.remove('border-white/10', 'text-gray-400');
                
                const ripple = targetNode.querySelector('.node-ripple');
                if (ripple) {
                    ripple.classList.remove('opacity-0', 'animate-ping'); // Removing old ping if it had one
                    ripple.classList.add('opacity-100', 'animate-pulse-ring');
                }
            }
            const targetRoute = document.querySelector(`.map-route[data-target="${locId}"]`);
            if (targetRoute) {
                targetRoute.setAttribute('stroke', '#D4AF37');
                // La ruta "se enciende": se redibuja en cada activación
                const len = targetRoute.getTotalLength();
                targetRoute.style.transition = 'none';
                targetRoute.style.strokeDasharray = `${len} ${len}`;
                targetRoute.style.strokeDashoffset = len;
                targetRoute.getBoundingClientRect(); // fuerza reflow
                targetRoute.style.transition = 'stroke-dashoffset 0.9s ease-in-out';
                targetRoute.style.strokeDashoffset = '0';
            }
            const targetTravelDot = document.querySelector(`.travel-dot[data-target="${locId}"]`);
            if (targetTravelDot && !prefersReducedMotion) {
                targetTravelDot.style.opacity = '1';
                const anim = targetTravelDot.querySelector('animateMotion');
                if (anim && anim.beginElement) { try { anim.beginElement(); } catch (e) {} }
            }
        }
    };

    if (mapSection && !prefersReducedMotion) {
        const mapObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !mapAnimated) {
                mapAnimated = true;
                
                // Animate lines (Stroke dash offset trick)
                mapRoutes.forEach((route, index) => {
                    const length = route.getTotalLength();
                    route.style.strokeDasharray = `${length} ${length}`;
                    route.style.strokeDashoffset = length;
                    route.style.opacity = '1';
                    
                    setTimeout(() => {
                        route.style.transition = 'stroke-dashoffset 1.5s ease-in-out';
                        route.style.strokeDashoffset = '0';
                    }, 500 + (index * 300));
                });

                // Scale up nodes (Tailwind v4: la propiedad `scale` se anima aparte)
                mapNodes.forEach((node, index) => {
                    setTimeout(() => {
                        node.style.scale = '1';
                    }, 200 + (index * 200));
                });

                // Sequential Highlight loop: primer beat al asentarse los nodos, luego cada 3s
                let currentIndex = 1; // Skip Miami initially
                const locIds = ['mia', 'sju', 'sdq', 'sti'];
                setTimeout(() => {
                    activateMapNode(locIds[currentIndex]);
                    currentIndex = (currentIndex + 1) % locIds.length;
                    setInterval(() => {
                        activateMapNode(locIds[currentIndex]);
                        currentIndex = (currentIndex + 1) % locIds.length;
                    }, 3000);
                }, 1400);
            }
        }, { threshold: 0.3 });
        mapObserver.observe(mapSection);
    } else {
        mapNodes.forEach(node => { node.style.scale = '1'; });
        mapRoutes.forEach(route => {
            route.style.opacity = '1';
            route.style.strokeDasharray = '2 2';
        });
    }

    // Hover logic for map list
    mapLocBtns.forEach(btn => {
        btn.addEventListener('mouseenter', () => activateMapNode(btn.getAttribute('data-loc')));
        btn.addEventListener('mouseleave', () => activateMapNode(null));
    });
    mapNodes.forEach(node => {
        node.addEventListener('mouseenter', () => activateMapNode(node.getAttribute('data-node')));
        node.addEventListener('mouseleave', () => activateMapNode(null));
    });

    // --- Services: asistente suave de alineado (sin snap CSS) ---
    const servicesSection = document.getElementById('services');
    if (servicesSection && !prefersReducedMotion) {
        const SNAP_THRESHOLD = 80; // px de cercanía para asistir (0 = apagado)
        let snapTimer = null;
        window.addEventListener('scroll', () => {
            clearTimeout(snapTimer);
            snapTimer = setTimeout(() => {
                const rect = servicesSection.getBoundingClientRect();
                if (Math.abs(rect.top) < SNAP_THRESHOLD && rect.height <= window.innerHeight + 1) {
                    window.scrollTo({ top: window.scrollY + rect.top, behavior: 'smooth' });
                }
            }, 120);
        }, { passive: true });
    }

    // --- Timeline Scroll ---
    const timelineContainer = document.getElementById('timeline-container');
    const timelineLineFill = document.getElementById('timeline-line-fill');
    const timelineNodes = document.querySelectorAll('.timeline-node');
    if (timelineContainer && timelineLineFill && !prefersReducedMotion) {
        window.addEventListener('scroll', () => {
            const rect = timelineContainer.getBoundingClientRect();
            const viewHeight = window.innerHeight;
            
            // Calculate progress when container is in view
            if (rect.top < viewHeight && rect.bottom > 0) {
                const totalScroll = rect.height;
                const currentScroll = viewHeight * 0.85 - rect.top;
                let progress = currentScroll / totalScroll;
                
                progress = Math.max(0, Math.min(1, progress));
                timelineLineFill.style.transform = `scaleY(${progress})`;
                
                // Highlight nodes as the line passes them
                const lineBottom = rect.top + (totalScroll * progress);
                timelineNodes.forEach(node => {
                    const nodeRect = node.getBoundingClientRect();
                    const nodeCenter = nodeRect.top + (nodeRect.height / 2);
                    
                    if (lineBottom >= nodeCenter) {
                        node.classList.remove('bg-[#05070A]', 'border-white/20');
                        node.classList.add('bg-[#0066FF]', 'border-[#0066FF]', 'shadow-[0_0_15px_#0066FF]');
                    } else {
                        node.classList.add('bg-[#05070A]', 'border-white/20');
                        node.classList.remove('bg-[#0066FF]', 'border-[#0066FF]', 'shadow-[0_0_15px_#0066FF]');
                    }
                });
            }
        });
    }

        // --- Quote Calculator ---
    let currentStep = 1;
    let estimatedCost = 0;
    let currentDisplayCost = 0;

    const form = document.getElementById('quote-form');
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const step3 = document.getElementById('step-3');
    const step4 = document.getElementById('step-4');
    const dots = document.querySelectorAll('.step-dot');

    // Live Estimate Updates
    const inputDest = document.getElementById('calc-dest');
    const inputTypeBtns = document.querySelectorAll('.type-btn');
    const typeInput = document.getElementById('calc-type-input');
    const displayRoute = document.getElementById('display-route');
    const displayService = document.getElementById('display-service');
    const displayTime = document.getElementById('display-time');
    const liveCostEl = document.getElementById('live-cost');
    const hiddenEstCost = document.getElementById('hidden-est-cost');

    // --- Altura dinámica del form (evita recortes en steps absolutos) ---
    form.style.transition = 'min-height 0.3s ease';
    const syncFormHeight = (el) => { form.style.minHeight = el.scrollHeight + 'px'; };
    syncFormHeight(step1);

    // Offsets iniciales de animación vía transform
    step2.style.transform = 'translateX(40px)';
    step3.style.transform = 'translateX(40px)';
    step4.style.transform = 'scale(0.95)';

    const goToStep = (n) => {
        currentStep = n;
        const steps = [step1, step2, step3, step4];
        steps.forEach((el, i) => {
            const active = i === n - 1;
            el.style.opacity = active ? '1' : '0';
            el.style.pointerEvents = active ? 'auto' : 'none';
            el.style.transform = active
                ? (el === step4 ? 'scale(1)' : 'translateX(0)')
                : (el === step4 ? 'scale(0.95)' : 'translateX(40px)');
        });
        dots.forEach((d, i) => {
            d.classList.toggle('bg-[#0066FF]', i < n);
            d.classList.toggle('glass', i >= n);
        });
        syncFormHeight(steps[n - 1]);
    };

    window.addEventListener('resize', () => syncFormHeight([step1, step2, step3, step4][currentStep - 1]));

    const updateLiveEstimateText = () => {
        const dest = inputDest.value;
        const type = typeInput.value;

        if (dest) {
            displayRoute.textContent = `MIA → ${dest}`;
            displayTime.textContent = type === 'Air' ? '1-2 Days' : '4-7 Days';
        } else {
            displayRoute.textContent = '---';
            displayTime.textContent = '---';
        }
        displayService.textContent = type;
    };

    inputDest.addEventListener('change', updateLiveEstimateText);

    inputTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            inputTypeBtns.forEach(b => {
                b.classList.remove('border-[#0066FF]', 'bg-[#0066FF]/20', 'text-[#0066FF]');
                b.classList.add('glass', 'text-white/70');
            });
            btn.classList.remove('glass', 'text-white/70');
            btn.classList.add('border-[#0066FF]', 'bg-[#0066FF]/20', 'text-[#0066FF]');
            typeInput.value = btn.getAttribute('data-type');
            updateLiveEstimateText();
        });
    });

    // Step Navigation
    const btnNext = document.getElementById('btn-next-step');
    const btnPrev = document.getElementById('btn-prev-step');
    const btnBackTo2 = document.getElementById('btn-back-to-2');
    const btnCalc = document.getElementById('btn-calc');
    const btnReset = document.getElementById('btn-reset-form');

    btnNext.addEventListener('click', () => {
        if (!inputDest.value) {
            inputDest.classList.add('border-red-500');
            return;
        }
        inputDest.classList.remove('border-red-500');
        goToStep(2);
    });

    btnPrev.addEventListener('click', () => goToStep(1));
    btnBackTo2.addEventListener('click', () => goToStep(2));

    // Form Submission & Calculation
    const animateValue = (start, end, duration) => {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min(timestamp / duration, 1);
            currentDisplayCost = Math.floor(progress * (end - start) + start);
            liveCostEl.textContent = currentDisplayCost.toLocaleString();
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    };

    // Calcular (step 2 → step 3)
    btnCalc.addEventListener('click', () => {
        if (!form.reportValidity()) return;
        const weight = parseFloat(document.getElementById('calc-weight').value) || 0;
        const l = parseFloat(document.getElementById('calc-l').value) || 0;
        const w = parseFloat(document.getElementById('calc-w').value) || 0;
        const h = parseFloat(document.getElementById('calc-h').value) || 0;

        const vol = (l * w * h) / 166;
        const chargeableWeight = Math.max(weight, vol);
        const baseRate = inputDest.value === 'PR' ? 1.5 : 2.1;

        estimatedCost = Math.floor(chargeableWeight * baseRate) + 350;
        hiddenEstCost.value = estimatedCost;

        // Review (step 3)
        document.getElementById('review-cost').textContent = estimatedCost.toLocaleString();
        document.getElementById('review-route').textContent = `MIA → ${inputDest.value}`;
        document.getElementById('review-service').textContent = typeInput.value;
        document.getElementById('review-weight').textContent = `${Math.round(chargeableWeight).toLocaleString()} lbs`;
        const firstName = (form.querySelector('[name="First Name"]').value || '').trim();
        const lastName = (form.querySelector('[name="Last Name"]').value || '').trim();
        document.getElementById('review-contact').textContent = `${firstName} ${lastName}` || '---';

        animateValue(0, estimatedCost, 1200);
        goToStep(3);
    });

    // Envío final (step 3 → Web3Forms → step 4)
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (new FormData(form).get('botcheck')) return; // bot detectado → descarta
        if (currentStep !== 3) return; // Enter en steps 1/2 no envía

        const btnSubmitText = document.getElementById('btn-submit-text');
        const btnSubmitSpinner = document.getElementById('btn-submit-spinner');
        const submitBtn = document.getElementById('btn-submit-lead');

        submitBtn.disabled = true;
        btnSubmitText.classList.add('hidden');
        btnSubmitSpinner.classList.remove('hidden');

        const formData = new FormData(form);
        fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            body: formData
        }).then(() => {
            goToStep(4);
            submitBtn.disabled = false;
            btnSubmitText.classList.remove('hidden');
            btnSubmitSpinner.classList.add('hidden');
        }).catch(error => {
            console.error('Error submitting quote', error);
            submitBtn.disabled = false;
            btnSubmitText.classList.remove('hidden');
            btnSubmitSpinner.classList.add('hidden');
            alert("Error submitting quote. Please try again.");
        });
    });

    btnReset.addEventListener('click', () => {
        form.reset();
        estimatedCost = 0;
        liveCostEl.textContent = "0";
        updateLiveEstimateText();
        goToStep(1);
    });

    // --- Floating Contact ---
    const floatingContainer = document.getElementById('floating-contact-container');
    const toggleBtn = document.getElementById('floating-toggle-btn');
    const chatBox = document.getElementById('floating-chat-box');
    const iconChat = document.getElementById('floating-icon-chat');
    const iconClose = document.getElementById('floating-icon-close');
    let isChatOpen = false;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
            floatingContainer.classList.remove('opacity-0', 'translate-y-20', 'pointer-events-none');
            floatingContainer.classList.add('opacity-100', 'translate-y-0');
        } else {
            floatingContainer.classList.add('opacity-0', 'translate-y-20', 'pointer-events-none');
            floatingContainer.classList.remove('opacity-100', 'translate-y-0');
            if (isChatOpen) toggleChat();
        }
    });

    const toggleChat = () => {
        isChatOpen = !isChatOpen;
        if (isChatOpen) {
            chatBox.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none', 'scale-95');
            chatBox.classList.add('opacity-100', 'translate-y-0', 'pointer-events-auto', 'scale-100');
            iconChat.classList.replace('opacity-100', 'opacity-0');
            iconClose.classList.replace('opacity-0', 'opacity-100');
        } else {
            chatBox.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none', 'scale-95');
            chatBox.classList.remove('opacity-100', 'translate-y-0', 'pointer-events-auto', 'scale-100');
            iconChat.classList.replace('opacity-0', 'opacity-100');
            iconClose.classList.replace('opacity-100', 'opacity-0');
        }
    };

    toggleBtn.addEventListener('click', toggleChat);
});
