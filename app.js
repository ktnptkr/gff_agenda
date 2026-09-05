// Application State
let currentDate = "all"; 
let currentTrack = "all";
let currentFormat = "all";
let currentRoom = "all";
let currentSpeaker = "all";
let currentCompany = "all";
let searchQuery = "";
let viewMode = "all"; 
let savedSessionIds = JSON.parse(localStorage.getItem('gff_saved_sessions')) || [];

const CURRENT_TIME = new Date("2026-09-09T10:40:00+05:30"); 

document.addEventListener("DOMContentLoaded", () => {
    if (typeof AGENDA_DATA === 'undefined') return;
    initTabs();
    initDateButtons();
    updateDropdowns();
    setupDrawer();
    setupListeners();
    renderAgenda();

    // Handle deep link hash AFTER agenda has initial render
    setTimeout(handleUrlHash, 200);

    // Background reminder checker
    setInterval(checkUpcomingReminders, 30000); 
});

// Deep Linking Handler
function handleUrlHash() {
    const hash = window.location.hash;
    if (hash.startsWith('#session=')) {
        const sessionId = hash.replace('#session=', '');
        const targetEvent = AGENDA_DATA.find(e => e.id === sessionId);
        if (targetEvent) {
            // If session is on a different date and current view is not 'all', switch date automatically
            if (currentDate !== 'all' && currentDate !== targetEvent.Date) {
                setDate(targetEvent.Date);
            }
            openDrawer(sessionId);
        }
    } else if (hash.startsWith('#saved=')) {
        const ids = hash.replace('#saved=', '').split(',');
        savedSessionIds = [...new Set([...savedSessionIds, ...ids])];
        localStorage.setItem('gff_saved_sessions', JSON.stringify(savedSessionIds));
        viewMode = 'saved';
        document.getElementById('tab-all').className = "px-4 py-1.5 rounded-md text-sm font-semibold text-white hover:text-slate-200 transition whitespace-nowrap";
        document.getElementById('tab-saved').className = "px-4 py-1.5 rounded-md text-sm font-semibold bg-white text-navy shadow transition whitespace-nowrap";
        showToast("Imported shared itinerary successfully!", "✅");
        renderAgenda();
    }
}

function initTabs() {
    const tabs = {
        all: document.getElementById('tab-all'),
        saved: document.getElementById('tab-saved'),
        live: document.getElementById('tab-live')
    };
    const actionsBar = document.getElementById('agenda-actions');

    const resetTabs = () => {
        Object.values(tabs).forEach(t => {
            t.className = t.id === 'tab-live' 
                ? "px-4 py-1.5 rounded-md text-sm font-semibold text-white hover:text-red-300 transition whitespace-nowrap flex items-center gap-1.5"
                : "px-4 py-1.5 rounded-md text-sm font-semibold text-white hover:text-slate-200 transition whitespace-nowrap";
        });
        if(actionsBar) actionsBar.classList.add('hidden');
    };

    tabs.all.addEventListener('click', () => {
        viewMode = "all"; resetTabs();
        tabs.all.className = "px-4 py-1.5 rounded-md text-sm font-semibold bg-white text-navy shadow transition whitespace-nowrap";
        updateDropdowns(); renderAgenda();
    });

    tabs.saved.addEventListener('click', () => {
        viewMode = "saved"; resetTabs();
        tabs.saved.className = "px-4 py-1.5 rounded-md text-sm font-semibold bg-white text-navy shadow transition whitespace-nowrap";
        if(actionsBar) actionsBar.classList.remove('hidden');
        updateDropdowns(); renderAgenda();
    });

    tabs.live.addEventListener('click', () => {
        viewMode = "live"; resetTabs();
        tabs.live.className = "px-4 py-1.5 rounded-md text-sm font-semibold bg-white text-red-600 shadow transition whitespace-nowrap flex items-center gap-1.5";
        updateDropdowns(); renderAgenda();
    });

    const notifBtn = document.getElementById('enable-notif-btn');
    if(notifBtn) {
        notifBtn.addEventListener('click', () => {
            if (!("Notification" in window)) {
                alert("This browser does not support desktop notifications.");
                return;
            }
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    showToast("Reminders enabled successfully!", "🔔");
                    notifBtn.innerText = "🔔 Reminders Active";
                    notifBtn.disabled = true;
                } else {
                    showToast("Notification permission denied.", "⚠️");
                }
            });
        });
    }
}

function initDateButtons() {
    const dates = [...new Set(AGENDA_DATA.map(e => e.Date).filter(Boolean))].sort();
    const container = document.getElementById('date-filters');
    
    let html = `<button onclick="setDate('all')" class="date-btn px-4 py-1.5 rounded-full text-sm font-semibold transition flex-shrink-0 ${currentDate === 'all' ? 'bg-navy text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}" data-date="all">All Dates</button>`;
    
    html += dates.map(date => {
        const d = new Date(date);
        const day = d.getDate().toString().padStart(2, '0');
        const month = d.toLocaleString('default', { month: 'short' });
        return `<button onclick="setDate('${date}')" class="date-btn px-4 py-1.5 rounded-full text-sm font-semibold transition flex-shrink-0 ${date === currentDate ? 'bg-navy text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}" data-date="${date}">
            ${day} ${month}
        </button>`;
    }).join('');
    
    container.innerHTML = html;
}

function setDate(date) {
    currentDate = date;
    document.querySelectorAll('.date-btn').forEach(btn => {
        btn.className = `date-btn px-4 py-1.5 rounded-full text-sm font-semibold transition flex-shrink-0 ${btn.getAttribute('data-date') === date ? 'bg-navy text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`;
    });
    updateDropdowns(); 
    renderAgenda();
}

function updateDropdowns() {
    let baseData = AGENDA_DATA;
    if (currentDate !== 'all') baseData = baseData.filter(e => e.Date === currentDate);
    if (viewMode === 'saved') baseData = baseData.filter(e => savedSessionIds.includes(e.id));
    if (viewMode === 'live') baseData = baseData.filter(e => checkLiveStatus(e.Date, e.Time).isLiveOrImminent);

    const extractUnique = (data, key, splitRegex) => {
        const set = new Set();
        data.forEach(e => {
            if (e[key]) {
                if (splitRegex) {
                    e[key].split(splitRegex).forEach(v => {
                        let clean = v.replace(/\(.*?\)/g, '').trim();
                        if (clean) set.add(clean);
                    });
                } else {
                    set.add(e[key].trim());
                }
            }
        });
        return [...set].sort();
    };

    populateSelect('room-filter', extractUnique(baseData, 'Location / Room'), currentRoom, 'All Rooms');
    populateSelect('track-filter', extractUnique(baseData, 'Tracks', /,/), currentTrack, 'All Tracks');
    populateSelect('format-filter', extractUnique(baseData, 'Format'), currentFormat, 'All Formats');
    populateSelect('speaker-filter', extractUnique(baseData, 'Speaker / Participant / Moderator', /,|\n/), currentSpeaker, 'All Speakers');
    populateSelect('company-filter', extractUnique(baseData, 'Company Name', /,|\n| and | & /), currentCompany, 'All Companies');
}

function populateSelect(id, options, currentValue, defaultLabel) {
    const el = document.getElementById(id);
    if(!el) return;
    el.innerHTML = `<option value="all">${defaultLabel} ▾</option>` + options.map(o => `<option value="${o}">${o}</option>`).join('');
    if (options.includes(currentValue)) {
        el.value = currentValue;
    } else {
        el.value = 'all';
        if (id === 'room-filter') currentRoom = 'all';
        if (id === 'track-filter') currentTrack = 'all';
        if (id === 'format-filter') currentFormat = 'all';
        if (id === 'speaker-filter') currentSpeaker = 'all';
        if (id === 'company-filter') currentCompany = 'all';
    }
}

function setupListeners() {
    const addEvt = (id, evt, fn) => { const el = document.getElementById(id); if(el) el.addEventListener(evt, fn); };
    addEvt('room-filter', 'change', e => { currentRoom = e.target.value; renderAgenda(); });
    addEvt('track-filter', 'change', e => { currentTrack = e.target.value; renderAgenda(); });
    addEvt('format-filter', 'change', e => { currentFormat = e.target.value; renderAgenda(); });
    addEvt('speaker-filter', 'change', e => { currentSpeaker = e.target.value; renderAgenda(); });
    addEvt('company-filter', 'change', e => { currentCompany = e.target.value; renderAgenda(); });
    addEvt('search-input', 'input', e => { searchQuery = e.target.value.toLowerCase(); renderAgenda(); });
}

function parseTimes(dateStr, timeStr) {
    if (!timeStr || !dateStr) return { start: new Date("2099-01-01"), end: new Date("2099-01-01") };
    const parts = timeStr.split("-");
    const startStr = parts[0].trim();
    const endStr = parts.length > 1 ? parts[1].trim() : startStr;
    return {
        start: new Date(`${dateStr}T${startStr}:00+05:30`),
        end: new Date(`${dateStr}T${endStr}:00+05:30`)
    };
}

function checkLiveStatus(dateStr, timeStr) {
    const { start, end } = parseTimes(dateStr, timeStr);
    const now = CURRENT_TIME.getTime();
    const startTime = start.getTime();
    const endTime = end.getTime();
    
    const isLive = now >= startTime && now <= endTime;
    const isPast = now > endTime;
    const isImminent = startTime > now && (startTime - now) <= (30 * 60 * 1000); 
    return { isLive, isPast, isImminent, isLiveOrImminent: isLive || isImminent, start, end };
}

function renderAgenda() {
    const feed = document.getElementById('event-feed');
    if(!feed) return;
    
    let filtered = AGENDA_DATA.filter(e => {
        if (viewMode === "saved" && !savedSessionIds.includes(e.id)) return false;
        if (viewMode === "live" && !checkLiveStatus(e.Date, e.Time).isLiveOrImminent) return false;
        if (currentDate !== "all" && e.Date !== currentDate) return false;
        
        if (currentRoom !== 'all' && e["Location / Room"] !== currentRoom) return false;
        if (currentTrack !== 'all' && (!e.Tracks || !e.Tracks.includes(currentTrack))) return false;
        if (currentFormat !== 'all' && e.Format !== currentFormat) return false;
        if (currentSpeaker !== 'all' && (!e["Speaker / Participant / Moderator"] || !e["Speaker / Participant / Moderator"].includes(currentSpeaker))) return false;
        if (currentCompany !== 'all' && (!e["Company Name"] || !e["Company Name"].includes(currentCompany))) return false;
        
        if (searchQuery) {
            const searchStr = `${e["Activity Name"]} ${e["Speaker / Participant / Moderator"]} ${e["Company Name"]} ${e["Location / Room"]} ${e.Tracks}`.toLowerCase();
            if (!searchStr.includes(searchQuery)) return false;
        }
        return true;
    });

    document.getElementById('current-date-header').innerText = currentDate === 'all' ? 'All Dates' : new Date(currentDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    document.getElementById('event-count').innerText = `${filtered.length} Sessions`;

    if (filtered.length === 0) {
        feed.innerHTML = `<div class="text-center py-16 text-slate-500 font-medium">No sessions found matching these filters.</div>`;
        return;
    }

    const grouped = {};
    filtered.forEach(e => {
        const key = currentDate === 'all' ? `${e.Date} | ${e.Time.split("-")[0].trim()}` : e.Time.split("-")[0].trim();
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(e);
    });

    const sortedKeys = Object.keys(grouped).sort();

    let html = '';
    sortedKeys.forEach(timeKey => {
        let displayTime = timeKey;
        if(currentDate === 'all') {
            const parts = timeKey.split(" | ");
            displayTime = `${new Date(parts[0]).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}, ${parts[1]}`;
        }

        html += `
        <div class="relative border-l-2 border-slate-200 ml-2 md:ml-4 pl-6 pb-2">
            <div class="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-slate-200 ring-4 ring-surface"></div>
            <h2 class="text-lg font-extrabold text-slate-800 mb-4 -mt-1">${displayTime}</h2>
            <div class="flex flex-col gap-4">
        `;

        grouped[timeKey].forEach(event => {
            const status = checkLiveStatus(event.Date, event.Time);
            const isSaved = savedSessionIds.includes(event.id);
            
            let speakers = event["Speaker / Participant / Moderator"] ? event["Speaker / Participant / Moderator"].replace(/\n/g, ', ') : "";
            if(speakers.length > 50) speakers = speakers.substring(0, 50) + '...';

            html += `
            <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm transition-all ${status.isPast ? 'past-event' : 'hover:shadow-md'} ${status.isLive ? 'ring-2 ring-red-500/50' : ''}">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex gap-2 items-center flex-wrap">
                        ${status.isLive ? '<span class="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded-md live-badge uppercase tracking-wide flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> LIVE NOW</span>' : ''}
                        ${status.isImminent && !status.isLive ? '<span class="text-[10px] font-bold px-2 py-0.5 bg-orange-100 text-orange-600 rounded-md uppercase tracking-wide">Starting Soon</span>' : ''}
                        ${status.isPast ? '<span class="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-md uppercase tracking-wide">Completed</span>' : ''}
                        <span class="text-xs font-semibold px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-100 rounded-md truncate max-w-[120px]">${event.Format || 'Session'}</span>
                    </div>
                    
                    <div class="flex items-center gap-1 flex-shrink-0">
                        <!-- Share Session Icon -->
                        <button onclick="shareSession('${event.id}', event)" class="p-1.5 rounded-full text-slate-400 hover:text-brand hover:bg-slate-100 transition" aria-label="Share session">
                            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                        </button>
                        <!-- Save Session Icon -->
                        <button onclick="toggleSave('${event.id}', event)" class="p-1.5 rounded-full transition ${isSaved ? 'text-brand bg-brand/10' : 'text-slate-400 hover:bg-slate-100'}" aria-label="Save">
                            <svg width="20" height="20" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
                        </button>
                    </div>
                </div>
                
                <h3 class="text-base font-bold text-navy leading-snug mb-3 cursor-pointer" onclick="openDrawer('${event.id}')">${event["Activity Name"]}</h3>
                
                <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 font-medium cursor-pointer" onclick="openDrawer('${event.id}')">
                    <span class="flex items-center gap-1">🕒 ${event.Time}</span>
                    <span class="flex items-center gap-1 text-brand hover:underline">📍 ${event["Location / Room"] || 'TBA'}</span>
                    ${speakers ? `<span class="flex items-center gap-1">👤 ${speakers}</span>` : ''}
                </div>
            </div>`;
        });
        html += `</div></div>`;
    });

    feed.innerHTML = html;
}

// Calendar Exports & Sharing
function exportCalendar(type) {
    const savedEvents = AGENDA_DATA.filter(e => savedSessionIds.includes(e.id));
    if (savedEvents.length === 0) {
        showToast("No saved sessions in My Agenda to export.", "⚠️");
        return;
    }
    exportICSFile(savedEvents);
}

function exportICSFile(events) {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//GFF 2026 Agenda//EN\n";
    
    events.forEach(e => {
        const { start, end } = parseTimes(e.Date, e.Time);
        const formatDate = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        icsContent += "BEGIN:VEVENT\n";
        icsContent += `UID:gff2026-${e.id}@globalfintechfest.com\n`;
        icsContent += `DTSTAMP:${formatDate(new Date())}\n`;
        icsContent += `DTSTART:${formatDate(start)}\n`;
        icsContent += `DTEND:${formatDate(end)}\n`;
        icsContent += `SUMMARY:${e["Activity Name"]}\n`;
        icsContent += `LOCATION:${e["Location / Room"] || 'Mumbai'}\n`;
        icsContent += `DESCRIPTION:${e.Description ? e.Description.replace(/\n/g, '\\n') : ''}\n`;
        icsContent += "END:VEVENT\n";
    });
    
    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', 'GFF_2026_My_Agenda.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Calendar file downloaded!", "📥");
}

function shareItinerary() {
    if (savedSessionIds.length === 0) {
        showToast("No saved sessions to share.", "⚠️");
        return;
    }
    const shareUrl = `${window.location.origin}${window.location.pathname}#saved=${savedSessionIds.join(',')}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("Itinerary share link copied to clipboard!", "🔗");
    });
}

function shareSession(id, eventObj) {
    if(eventObj) eventObj.stopPropagation();
    const shareUrl = `${window.location.origin}${window.location.pathname}#session=${id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("Session link copied to clipboard!", "🔗");
    });
}

// Background Reminder Checker
function checkUpcomingReminders() {
    if (Notification.permission !== "granted") return;
    const now = new Date().getTime();

    savedSessionIds.forEach(id => {
        const event = AGENDA_DATA.find(e => e.id === id);
        if (!event) return;
        const { start } = parseTimes(event.Date, event.Time);
        const startTime = start.getTime();
        const diffMinutes = (startTime - now) / (1000 * 60);

        if (diffMinutes >= 9 && diffMinutes <= 11) {
            const notifiedKey = `notified_${id}`;
            if (!localStorage.getItem(notifiedKey)) {
                new Notification(`Starting Soon: ${event["Activity Name"]}`, {
                    body: `At ${event["Location / Room"] || 'Main Stage'} in 10 minutes!`,
                    icon: 'https://www.globalfintechfest.com/favicon.ico'
                });
                localStorage.setItem(notifiedKey, 'true');
            }
        }
    });
}

// Save & Conflict Logic
function toggleSave(id, eventObj) {
    if(eventObj) eventObj.stopPropagation();
    const eventData = AGENDA_DATA.find(e => e.id === id);
    const newStatus = checkLiveStatus(eventData.Date, eventData.Time);

    if (savedSessionIds.includes(id)) {
        savedSessionIds = savedSessionIds.filter(savedId => savedId !== id);
        showToast("Removed from My Agenda", "✅");
    } else {
        const hasConflict = savedSessionIds.some(savedId => {
            const savedEvent = AGENDA_DATA.find(e => e.id === savedId);
            if (!savedEvent || savedEvent.Date !== eventData.Date) return false;
            const savedStatus = checkLiveStatus(savedEvent.Date, savedEvent.Time);
            return (newStatus.start < savedStatus.end && newStatus.end > savedStatus.start); 
        });

        if (hasConflict) {
            showToast("Conflict: Time overlaps with a saved session!", "⚠️");
        } else {
            savedSessionIds.push(id);
            showToast("Added to My Agenda", "✅");
        }
    }
    
    localStorage.setItem('gff_saved_sessions', JSON.stringify(savedSessionIds));
    if(viewMode === 'saved') updateDropdowns();
    renderAgenda();
}

function showToast(msg, icon) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    document.getElementById('toast-icon').innerText = icon;
    toast.classList.remove('opacity-0', 'pointer-events-none');
    setTimeout(() => toast.classList.add('opacity-0', 'pointer-events-none'), 3000);
}

// Drawer Logic
const drawerOverlay = document.getElementById('drawer-overlay');
const drawer = document.getElementById('drawer');
const drawerContent = document.getElementById('drawer-content');

function setupDrawer() {
    document.getElementById('close-drawer').addEventListener('click', closeDrawer);
    drawerOverlay.addEventListener('click', closeDrawer);
}

function openDrawer(id) {
    const event = AGENDA_DATA.find(e => e.id === id);
    if(!event) return;

    document.getElementById('drawer-format').innerText = event.Format || 'Session';
    document.getElementById('drawer-share-btn').setAttribute('onclick', `shareSession('${event.id}')`);
    
    drawerContent.innerHTML = `
        <h2 class="text-xl font-bold text-navy leading-tight mb-4">${event["Activity Name"]}</h2>
        <div class="flex flex-wrap items-center gap-4 text-sm text-slate-600 mb-6 font-medium bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span class="flex items-center gap-1.5">📅 ${new Date(event.Date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</span>
            <span class="flex items-center gap-1.5">🕒 ${event.Time}</span>
            <span class="flex items-center gap-1.5 text-brand">📍 ${event["Location / Room"] || 'TBA'}</span>
        </div>
        
        ${event.Description ? `
        <div class="mb-6">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">About</h3>
            <p class="text-sm text-slate-700 leading-relaxed">${event.Description}</p>
        </div>` : ''}

        ${event["Speaker / Participant / Moderator"] ? `
        <div class="mb-6">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Speakers</h3>
            <div class="text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-line">${event["Speaker / Participant / Moderator"]}</div>
        </div>` : ''}

        ${event["Company Name"] ? `
        <div class="mb-6">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Companies</h3>
            <p class="text-sm text-slate-600 leading-relaxed">${event["Company Name"]}</p>
        </div>` : ''}
        
        ${event.Tracks ? `
        <div class="pt-4 border-t border-slate-200/50 flex flex-wrap gap-2">
            ${event.Tracks.split(',').map(t => `<span class="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-[11px] uppercase tracking-wider font-bold rounded-md shadow-sm">${t.trim()}</span>`).join('')}
        </div>` : ''}
    `;

    drawerOverlay.classList.remove('hidden');
    setTimeout(() => {
        drawerOverlay.classList.remove('opacity-0');
        drawer.classList.remove('translate-y-full');
    }, 10);
}

function closeDrawer() {
    drawerOverlay.classList.add('opacity-0');
    drawer.classList.add('translate-y-full');
    setTimeout(() => drawerOverlay.classList.add('hidden'), 300);
}