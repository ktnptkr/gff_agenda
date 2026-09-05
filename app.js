// Application State
let currentDate = "2026-09-09"; 
let currentTrack = "all";
let currentFormat = "all";
let searchQuery = "";
let viewMode = "all"; // 'all' or 'saved'
let savedSessionIds = JSON.parse(localStorage.getItem('gff_saved_sessions')) || [];

// Testing Configuration
// System Time: Sept 5. Change to Sept 9 to see Live/Past logic work.
const CURRENT_TIME = new Date("2026-09-09T10:40:00+05:30"); 

document.addEventListener("DOMContentLoaded", () => {
    if (typeof AGENDA_DATA === 'undefined') return;
    initFilters();
    initTabs();
    setupDrawer();
    renderAgenda();
});

function initTabs() {
    const tabAll = document.getElementById('tab-all');
    const tabSaved = document.getElementById('tab-saved');

    tabAll.addEventListener('click', () => {
        viewMode = "all";
        tabAll.className = "px-4 py-1.5 rounded-md text-sm font-semibold bg-white text-navy shadow transition";
        tabSaved.className = "px-4 py-1.5 rounded-md text-sm font-semibold text-white hover:text-slate-200 transition";
        renderAgenda();
    });

    tabSaved.addEventListener('click', () => {
        viewMode = "saved";
        tabSaved.className = "px-4 py-1.5 rounded-md text-sm font-semibold bg-white text-navy shadow transition";
        tabAll.className = "px-4 py-1.5 rounded-md text-sm font-semibold text-white hover:text-slate-200 transition";
        renderAgenda();
    });
}

function initFilters() {
    const dates = [...new Set(AGENDA_DATA.map(e => e.Date).filter(Boolean))].sort();
    
    let allTracks = [];
    AGENDA_DATA.forEach(e => { if(e.Tracks) e.Tracks.split(',').forEach(t => allTracks.push(t.trim())); });
    const uniqueTracks = [...new Set(allTracks)].sort();
    const formats = [...new Set(AGENDA_DATA.map(e => e.Format).filter(Boolean))].sort();

    if(dates.length > 0) currentDate = dates[0];
    
    document.getElementById('date-filters').innerHTML = dates.map(date => {
        const d = new Date(date);
        const day = d.getDate().toString().padStart(2, '0');
        const month = d.toLocaleString('default', { month: 'short' });
        return `<button onclick="setDate('${date}')" class="date-btn px-4 py-1.5 rounded-full text-sm font-semibold transition flex-shrink-0 ${date === currentDate ? 'bg-navy text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}" data-date="${date}">
            ${day} ${month}
        </button>`;
    }).join('');

    const trackFilter = document.getElementById('track-filter');
    uniqueTracks.forEach(t => trackFilter.innerHTML += `<option value="${t}">${t}</option>`);
    const formatFilter = document.getElementById('format-filter');
    formats.forEach(f => formatFilter.innerHTML += `<option value="${f}">${f}</option>`);

    trackFilter.addEventListener('change', e => { currentTrack = e.target.value; renderAgenda(); });
    formatFilter.addEventListener('change', e => { currentFormat = e.target.value; renderAgenda(); });
    document.getElementById('search-input').addEventListener('input', e => { searchQuery = e.target.value.toLowerCase(); renderAgenda(); });
}

function setDate(date) {
    currentDate = date;
    document.querySelectorAll('.date-btn').forEach(btn => {
        btn.className = `date-btn px-4 py-1.5 rounded-full text-sm font-semibold transition flex-shrink-0 ${btn.getAttribute('data-date') === date ? 'bg-navy text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`;
    });
    renderAgenda();
}

// Time Logic
function parseTimes(dateStr, timeStr) {
    if (!timeStr) return { start: new Date("2099-01-01"), end: new Date("2099-01-01") };
    const parts = timeStr.split("-");
    const startStr = parts[0].trim();
    const endStr = parts.length > 1 ? parts[1].trim() : startStr;
    return {
        start: new Date(`${dateStr}T${startStr}:00+05:30`),
        end: new Date(`${dateStr}T${endStr}:00+05:30`)
    };
}

function renderAgenda() {
    const feed = document.getElementById('event-feed');
    
    // Filter
    let filtered = AGENDA_DATA.filter(e => {
        if (viewMode === "saved" && !savedSessionIds.includes(e.id)) return false;
        if (viewMode === "all" && e.Date !== currentDate) return false;
        if (currentTrack !== 'all' && (!e.Tracks || !e.Tracks.includes(currentTrack))) return false;
        if (currentFormat !== 'all' && e.Format !== currentFormat) return false;
        if (searchQuery) {
            const searchStr = `${e["Activity Name"]} ${e["Speaker / Participant / Moderator"]} ${e["Company Name"]} ${e["Location / Room"]}`.toLowerCase();
            if (!searchStr.includes(searchQuery)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        feed.innerHTML = `<div class="text-center py-16 text-slate-500 font-medium">No sessions found in ${viewMode === 'saved' ? 'My Agenda' : 'this view'}.</div>`;
        return;
    }

    // Group by Start Time
    const grouped = {};
    filtered.forEach(e => {
        const timeSplit = e.Time.split("-");
        const startTime = timeSplit[0].trim();
        if (!grouped[startTime]) grouped[startTime] = [];
        grouped[startTime].push(e);
    });

    // Sort times
    const sortedTimes = Object.keys(grouped).sort();

    let html = '';
    sortedTimes.forEach(time => {
        html += `
        <div class="relative border-l-2 border-slate-200 ml-2 md:ml-4 pl-6 pb-2">
            <div class="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-slate-200 ring-4 ring-surface"></div>
            <h2 class="text-lg font-extrabold text-slate-800 mb-4 -mt-1">${time}</h2>
            <div class="flex flex-col gap-4">
        `;

        grouped[time].forEach(event => {
            const { start, end } = parseTimes(event.Date, event.Time);
            const isLive = CURRENT_TIME >= start && CURRENT_TIME <= end;
            const isPast = CURRENT_TIME > end;
            const isSaved = savedSessionIds.includes(event.id);
            
            let speakers = event["Speaker / Participant / Moderator"] ? event["Speaker / Participant / Moderator"].replace(/\n/g, ', ') : "";
            if(speakers.length > 50) speakers = speakers.substring(0, 50) + '...';

            html += `
            <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm transition-all ${isPast ? 'past-event' : 'hover:shadow-md'} ${isLive ? 'ring-2 ring-red-500/50' : ''}">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex gap-2 items-center">
                        ${isLive ? '<span class="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded-md live-badge uppercase tracking-wide flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> LIVE NOW</span>' : ''}
                        ${isPast ? '<span class="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-md uppercase tracking-wide">Completed</span>' : ''}
                        <span class="text-xs font-semibold px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-100 rounded-md">${event.Format || 'Session'}</span>
                    </div>
                    <button onclick="toggleSave('${event.id}', event)" class="p-1.5 rounded-full transition ${isSaved ? 'text-brand bg-brand/10' : 'text-slate-400 hover:bg-slate-100'}" aria-label="Save">
                        <svg width="20" height="20" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
                    </button>
                </div>
                
                <h3 class="text-base font-bold text-navy leading-snug mb-3 cursor-pointer" onclick="openDrawer('${event.id}')">${event["Activity Name"]}</h3>
                
                <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 font-medium cursor-pointer" onclick="openDrawer('${event.id}')">
                    <span class="flex items-center gap-1">🕒 ${event.Time}</span>
                    <span class="flex items-center gap-1 text-brand hover:underline">📍 ${event["Location / Room"] || 'TBA'} →</span>
                    ${speakers ? `<span class="flex items-center gap-1">👤 ${speakers}</span>` : ''}
                </div>
            </div>`;
        });
        html += `</div></div>`;
    });

    feed.innerHTML = html;
}

// Save & Conflict Logic
function toggleSave(id, eventObj) {
    eventObj.stopPropagation(); // prevent drawer opening
    const eventData = AGENDA_DATA.find(e => e.id === id);
    const { start: newStart, end: newEnd } = parseTimes(eventData.Date, eventData.Time);

    if (savedSessionIds.includes(id)) {
        savedSessionIds = savedSessionIds.filter(savedId => savedId !== id);
        showToast("Session removed from My Agenda", "✅");
    } else {
        // Conflict Detection
        const hasConflict = savedSessionIds.some(savedId => {
            const savedEvent = AGENDA_DATA.find(e => e.id === savedId);
            if (!savedEvent || savedEvent.Date !== eventData.Date) return false;
            const { start: savedStart, end: savedEnd } = parseTimes(savedEvent.Date, savedEvent.Time);
            return (newStart < savedEnd && newEnd > savedStart); // Overlap formula
        });

        if (hasConflict) {
            showToast("Schedule Conflict: Time overlaps with a saved session", "⚠️");
        } else {
            savedSessionIds.push(id);
            showToast("Session added to My Agenda", "✅");
        }
    }
    
    localStorage.setItem('gff_saved_sessions', JSON.stringify(savedSessionIds));
    renderAgenda();
}

function showToast(msg, icon) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    document.getElementById('toast-icon').innerText = icon;
    toast.classList.remove('opacity-0', 'translate-y-[-100%]');
    setTimeout(() => toast.classList.add('opacity-0', 'translate-y-[-100%]'), 3000);
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
    
    drawerContent.innerHTML = `
        <h2 class="text-xl font-bold text-navy leading-tight mb-4">${event["Activity Name"]}</h2>
        <div class="flex flex-wrap items-center gap-4 text-sm text-slate-600 mb-6 font-medium bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span class="flex items-center gap-1.5">📅 ${new Date(event.Date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</span>
            <span class="flex items-center gap-1.5">🕒 ${event.Time}</span>
            <span class="flex items-center gap-1.5 text-brand">📍 ${event["Location / Room"] || 'TBA'} <a href="#" class="text-[10px] underline ml-1">Map</a></span>
        </div>
        
        <div class="mb-6">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">About</h3>
            <p class="text-sm text-slate-700 leading-relaxed">${event.Description || 'No description available for this session.'}</p>
        </div>

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