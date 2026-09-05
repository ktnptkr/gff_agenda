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

// Use actual real-time clock for "Live Now" matching
const CURRENT_TIME = new Date(); 

// Supabase Configuration
const SUPABASE_URL = 'https://prsqblepuzjlucnqqvsd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5UrWBbB3NAzcmkM1olFlSA_1n139nf8';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let isChatOpen = false;

const LIVE_ANNOUNCEMENTS = [
    { text: "Hall 102 events are underway. Check the agenda for live room updates.", time: "10:35 AM" },
    { text: "Welcome to Global Fintech Fest 2026! Explore tracks and network via attendee chat.", time: "10:15 AM" }
];

document.addEventListener("DOMContentLoaded", () => {
    if (typeof AGENDA_DATA === 'undefined') return;
    
    checkAnnouncements();
    handleUrlHash();
    initTabs();
    initDateButtons();
    updateDropdowns();
    setupDrawer();
    setupListeners();
    renderAgenda();

    setInterval(checkUpcomingReminders, 30000); 
});

// Chat Drawer & Validation Logic with GTM Lead Storage
function toggleChatDrawer() {
    isChatOpen = !isChatOpen;
    const drawer = document.getElementById('chat-drawer');
    if (isChatOpen) {
        drawer.classList.remove('translate-y-full');
        checkChatValidationState();
    } else {
        drawer.classList.add('translate-y-full');
    }
}

function checkChatValidationState() {
    const savedProfile = localStorage.getItem('gff_user_profile');
    const gate = document.getElementById('chat-gate');
    const mainArea = document.getElementById('chat-main-area');

    if (savedProfile) {
        gate.classList.add('hidden');
        mainArea.classList.remove('hidden');
        fetchChatHistory();
        subscribeToRealtimeChat();
    } else {
        gate.classList.remove('hidden');
        mainArea.classList.add('hidden');
    }
}

async function submitChatValidation() {
    const name = document.getElementById('val-name').value.trim();
    const org = document.getElementById('val-org').value.trim();
    const email = document.getElementById('val-email').value.trim();
    const mobile = document.getElementById('val-mobile').value.trim();
    const desig = document.getElementById('val-desig').value.trim();
    const attendingRadio = document.querySelector('input[name="val-attending"]:checked');
    const attending = attendingRadio ? attendingRadio.value : 'Yes';

    if (!name || !org || !email || !desig) {
        showToast("Please fill in all mandatory fields (*)", "⚠️");
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast("Please enter a valid work email address", "⚠️");
        return;
    }

    const profile = { name, org, email, mobile, desig, attending };

    // Store details in DB for GTM purposes
    const { error } = await supabaseClient
        .from('gff_leads')
        .insert([{ 
            name: name, 
            organization: org, 
            email: email, 
            mobile: mobile || null, 
            designation: desig, 
            attending: attending 
        }]);

    if (error) {
        console.error("Error saving lead to database:", error);
    }

    localStorage.setItem('gff_user_profile', JSON.stringify(profile));
    showToast("Profile verified successfully!", "✅");
    checkChatValidationState();
}

async function fetchChatHistory() {
    const { data, error } = await supabaseClient
        .from('gff_chat')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);

    if (!error && data) {
        renderMessages(data);
    }
}

function subscribeToRealtimeChat() {
    supabaseClient
        .channel('public:gff_chat')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gff_chat' }, payload => {
            appendMessageToDOM(payload.new);
        })
        .subscribe();
}

async function sendChatMessage() {
    const msgInput = document.getElementById('chat-msg-input');
    const message = msgInput.value.trim();
    if (!message) return;

    const profile = JSON.parse(localStorage.getItem('gff_user_profile'));
    if (!profile) {
        toggleChatDrawer();
        return;
    }

    const displayName = `${profile.name} (${profile.desig}, ${profile.org})`;

    const { error } = await supabaseClient
        .from('gff_chat')
        .insert([{ user_name: displayName, message: message }]);

    if (!error) {
        msgInput.value = '';
        const dropdown = document.getElementById('chat-mention-dropdown');
        if(dropdown) dropdown.classList.add('hidden');
    } else {
        showToast("Failed to send message", "⚠️");
    }
}

function handleChatKeyPress(e) {
    if (e.key === 'Enter') {
        const dropdown = document.getElementById('chat-mention-dropdown');
        if(dropdown) dropdown.classList.add('hidden');
        sendChatMessage();
    }
}

function renderMessages(messages) {
    const container = document.getElementById('chat-messages');
    if(!container) return;
    container.innerHTML = messages.map(m => createMessageHTML(m)).join('');
    container.scrollTop = container.scrollHeight;
}

function appendMessageToDOM(m) {
    const container = document.getElementById('chat-messages');
    if(!container) return;
    container.innerHTML += createMessageHTML(m);
    container.scrollTop = container.scrollHeight;
}

// Session Tagging / Mention Logic in Chat
function handleChatInput(e) {
    const val = e.target.value;
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    const dropdown = document.getElementById('chat-mention-dropdown');
    if(!dropdown) return;

    if (lastAtIndex !== -1 && (lastAtIndex === 0 || textBeforeCursor[lastAtIndex - 1] === ' ')) {
        const query = textBeforeCursor.substring(lastAtIndex + 1).toLowerCase();
        
        const matches = AGENDA_DATA.filter(item => 
            item["Activity Name"].toLowerCase().includes(query) || 
            item.Time.toLowerCase().includes(query)
        ).slice(0, 6);

        if (matches.length > 0) {
            dropdown.innerHTML = matches.map(m => `
                <div onclick="selectSessionTag('${m.id}', '${m["Activity Name"].replace(/'/g, "\\'")}')" class="p-2.5 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-b-0">
                    <p class="font-bold text-navy truncate">🗓️ ${m["Activity Name"]}</p>
                    <p class="text-[10px] text-slate-400">🕒 ${m.Time} • 📍 ${m["Location / Room"] || 'TBA'}</p>
                </div>
            `).join('');
            dropdown.classList.remove('hidden');
            return;
        }
    }
    dropdown.classList.add('hidden');
}

function selectSessionTag(sessionId, sessionTitle) {
    const input = document.getElementById('chat-msg-input');
    if(!input) return;
    const val = input.value;
    const cursor = input.selectionStart;
    const textBeforeCursor = val.substring(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    const textAfterCursor = val.substring(cursor);
    input.value = `${textBeforeCursor.substring(0, lastAtIndex)}@[${sessionTitle}](${sessionId}) ${textAfterCursor}`;
    
    document.getElementById('chat-mention-dropdown').classList.add('hidden');
    input.focus();
}

function createMessageHTML(m) {
    const profile = JSON.parse(localStorage.getItem('gff_user_profile')) || {};
    const myDisplayName = `${profile.name} (${profile.desig}, ${profile.org})`;
    const isMe = m.user_name === myDisplayName;

    let formattedMessage = escapeHTML(m.message || '');
    const tagRegex = /@\[(.*?)\]\((.*?)\)/g;
    formattedMessage = formattedMessage.replace(tagRegex, (match, title, id) => {
        let displayTitle = title;
        if (!displayTitle || displayTitle.trim() === '') {
            const found = AGENDA_DATA.find(e => e.id === id);
            displayTitle = found ? found["Activity Name"] : "View Session";
        }
        return `<span onclick="openDrawer('${id}')" class="inline-flex items-center gap-1 bg-white/20 text-white font-semibold px-2.5 py-1 rounded-md cursor-pointer hover:underline my-0.5 border border-white/30">📅 ${escapeHTML(displayTitle)}</span>`;
    });

    return `
        <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
            <span class="text-[10px] font-bold text-slate-400 mb-0.5">${escapeHTML(m.user_name || 'Attendee')}</span>
            <div class="max-w-[85%] rounded-2xl px-3 py-2 text-xs ${isMe ? 'bg-brand text-white rounded-br-none' : 'bg-slate-200 text-slate-800 rounded-bl-none'}">
                ${formattedMessage}
            </div>
        </div>
    `;
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

// Announcements Logic
function checkAnnouncements() {
    const banner = document.getElementById('live-announcement-banner');
    const textEl = document.getElementById('announcement-text');
    if (banner && textEl && LIVE_ANNOUNCEMENTS.length > 0 && !localStorage.getItem('dismissed_announcement')) {
        textEl.innerText = LIVE_ANNOUNCEMENTS[0].text;
        banner.classList.remove('hidden');
    }
}

function dismissAnnouncement() {
    document.getElementById('live-announcement-banner').classList.add('hidden');
    localStorage.setItem('dismissed_announcement', 'true');
}

// Deep Linking Handler
function handleUrlHash() {
    const hash = window.location.hash;
    if (hash.startsWith('#session=')) {
        const sessionId = hash.replace('#session=', '');
        const targetEvent = AGENDA_DATA.find(e => e.id === sessionId);
        if (targetEvent) {
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
            if(!t) return;
            t.className = t.id === 'tab-live' 
                ? "px-4 py-1.5 rounded-md text-sm font-semibold text-white hover:text-red-300 transition whitespace-nowrap flex items-center gap-1.5"
                : "px-4 py-1.5 rounded-md text-sm font-semibold text-white hover:text-slate-200 transition whitespace-nowrap";
        });
        if(actionsBar) actionsBar.classList.add('hidden');
    };

    if(tabs.all) tabs.all.addEventListener('click', () => {
        viewMode = "all"; resetTabs();
        tabs.all.className = "px-4 py-1.5 rounded-md text-sm font-semibold bg-white text-navy shadow transition whitespace-nowrap";
        updateDropdowns(); renderAgenda();
    });

    if(tabs.saved) tabs.saved.addEventListener('click', () => {
        viewMode = "saved"; resetTabs();
        tabs.saved.className = "px-4 py-1.5 rounded-md text-sm font-semibold bg-white text-navy shadow transition whitespace-nowrap";
        if(actionsBar) actionsBar.classList.remove('hidden');
        updateDropdowns(); renderAgenda();
    });

    if(tabs.live) tabs.live.addEventListener('click', () => {
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
    if(!container) return;
    
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
    if (viewMode === 'live') baseData = baseData.filter(e => checkLiveStatus(e.Date, e.Time).isLive);

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
    populateSelect('speaker-filter', extractUnique(baseData, 'Moderator / Speaker / Participant', /,|\n/), currentSpeaker, 'All Speakers');
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
        const status = checkLiveStatus(e.Date, e.Time);
        if (viewMode === "saved" && !savedSessionIds.includes(e.id)) return false;
        if (viewMode === "live" && !status.isLive) return false;
        if (currentDate !== "all" && e.Date !== currentDate) return false;
        
        if (currentRoom !== 'all' && e["Location / Room"] !== currentRoom) return false;
        if (currentTrack !== 'all' && (!e.Tracks || !e.Tracks.includes(currentTrack))) return false;
        if (currentFormat !== 'all' && e.Format !== currentFormat) return false;
        if (currentSpeaker !== 'all' && (!e["Moderator / Speaker / Participant"] || !e["Moderator / Speaker / Participant"].includes(currentSpeaker))) return false;
        if (currentCompany !== 'all' && (!e["Company Name"] || !e["Company Name"].includes(currentCompany))) return false;
        
        if (searchQuery) {
            const searchStr = `${e["Activity Name"]} ${e["Moderator / Speaker / Participant"]} ${e["Company Name"]} ${e["Location / Room"]} ${e.Tracks}`.toLowerCase();
            if (!searchStr.includes(searchQuery)) return false;
        }
        return true;
    });

    const dateHeader = document.getElementById('current-date-header');
    const eventCount = document.getElementById('event-count');
    if(dateHeader) dateHeader.innerText = currentDate === 'all' ? 'All Dates' : new Date(currentDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if(eventCount) eventCount.innerText = `${filtered.length} Sessions`;

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
            
            let speakers = event["Moderator / Speaker / Participant"] ? event["Moderator / Speaker / Participant"].replace(/\n/g, ', ') : "";
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
                        <button onclick="shareSession('${event.id}', event)" class="p-1.5 rounded-full text-slate-400 hover:text-brand hover:bg-slate-100 transition" aria-label="Share session">
                            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684Z"></path></svg>
                        </button>
                        <button onclick="toggleSave('${event.id}', event)" class="p-1.5 rounded-full transition ${isSaved ? 'text-brand bg-brand/10' : 'text-slate-400 hover:bg-slate-100'}" aria-label="Save">
                            <svg width="20" height="20" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
                        </button>
                    </div>
                </div>
                
                <h3 class="text-base font-bold text-navy leading-snug mb-3 cursor-pointer" onclick="openDrawer('${event.id}')">${event["Activity Name"]}</h3>
                
                <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 font-medium">
                    <span class="cursor-pointer" onclick="openDrawer('${event.id}')">🕒 ${event.Time}</span>
                    <span class="text-brand hover:underline cursor-pointer font-semibold" onclick="openVenueMap('${event["Location / Room"] || 'Main Hall'}')">📍 ${event["Location / Room"] || 'TBA'} (Map)</span>
                    ${speakers ? `<span class="cursor-pointer" onclick="openDrawer('${event.id}')">👤 ${speakers}</span>` : ''}
                </div>
            </div>`;
        });
        html += `</div></div>`;
    });

    feed.innerHTML = html;
}

// Venue Map Navigation
function openVenueMap(roomName) {
    const mapModal = document.getElementById('map-modal');
    const mapOverlay = document.getElementById('map-overlay');
    const content = document.getElementById('map-content');
    if(!content) return;
    content.innerHTML = `
        <div class="mb-4"><h3 class="text-lg font-bold text-navy">${roomName}</h3><p class="text-xs text-slate-500">Jio World Convention Centre, Mumbai</p></div>
        <div class="bg-slate-100 rounded-2xl p-4 border border-slate-200 relative overflow-hidden flex flex-col items-center justify-center min-h-[200px]">
            <span class="text-4xl mb-2">🗺️</span>
            <p class="text-sm font-bold text-navy">Interactive Floor Plan</p>
            <p class="text-xs text-slate-600 mt-1">Route: Main Escalator -> Level 2 -> ${roomName}</p>
        </div>`;
    mapOverlay.classList.remove('hidden');
    setTimeout(() => { mapOverlay.classList.remove('opacity-0'); mapModal.classList.remove('translate-y-full'); }, 10);
}

function closeMapModal() {
    const mapModal = document.getElementById('map-modal');
    const mapOverlay = document.getElementById('map-overlay');
    if(mapOverlay && mapModal) {
        mapOverlay.classList.add('opacity-0'); 
        mapModal.classList.add('translate-y-full');
        setTimeout(() => mapOverlay.classList.add('hidden'), 300);
    }
}

// Calendar Exports & Sharing
function exportCalendar(type) {
    const savedEvents = AGENDA_DATA.filter(e => savedSessionIds.includes(e.id));
    if (savedEvents.length === 0) {
        showToast("No saved sessions in My Agenda to export.", "⚠️");
        return;
    }
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//GFF 2026 Agenda//EN\n";
    savedEvents.forEach(e => {
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
    if (navigator.share) {
        navigator.share({ title: 'My GFF 2026 Itinerary', url: shareUrl }).catch(() => {});
    } else {
        navigator.clipboard.writeText(shareUrl).then(() => showToast("Link copied!", "🔗"));
    }
}

function shareSession(id, eventObj) {
    if(eventObj) eventObj.stopPropagation();
    const event = AGENDA_DATA.find(e => e.id === id);
    const shareUrl = `${window.location.origin}${window.location.pathname}#session=${id}`;
    if (navigator.share) {
        navigator.share({
            title: event ? event["Activity Name"] : 'GFF 2026 Session',
            text: `Check out: "${event?.["Activity Name"]}" at ${event?.["Location / Room"] || ''}`,
            url: shareUrl,
        }).catch(() => {});
    } else {
        navigator.clipboard.writeText(shareUrl).then(() => showToast("Session link copied!", "🔗"));
    }
}

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
                new Notification(`Starting Soon: ${event["Activity Name"]}`, { body: `At ${event["Location / Room"] || 'Main Stage'} in 10 minutes!` });
                localStorage.setItem(notifiedKey, 'true');
            }
        }
    });
}

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
    if(!toast) return;
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
    const closeBtn = document.getElementById('close-drawer');
    if(closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if(drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);
}

function openDrawer(id) {
    const event = AGENDA_DATA.find(e => e.id === id);
    if(!event || !drawerContent) return;

    document.getElementById('drawer-format').innerText = event.Format || 'Session';
    const shareBtn = document.getElementById('drawer-share-btn');
    if(shareBtn) shareBtn.setAttribute('onclick', `shareSession('${event.id}')`);
    
    const topicQuery = encodeURIComponent(event["Activity Name"]);
    const rawDesc = event.Description || '';
    const isLongDesc = rawDesc.length > 75;
    const truncatedDesc = isLongDesc ? rawDesc.substring(0, 75) + '...' : rawDesc;

    drawerContent.innerHTML = `
        <h2 class="text-xl font-bold text-navy leading-tight mb-4">${event["Activity Name"]}</h2>
        <div class="flex flex-wrap items-center gap-4 text-sm text-slate-600 mb-6 font-medium bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span class="flex items-center gap-1.5">📅 ${new Date(event.Date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</span>
            <span class="flex items-center gap-1.5">🕒 ${event.Time}</span>
            <span class="flex items-center gap-1.5 text-brand">📍 ${event["Location / Room"] || 'TBA'}</span>
        </div>
        
        ${rawDesc ? `
        <div class="mb-6">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">About</h3>
            <div id="desc-container" class="text-sm text-slate-700 leading-relaxed">
                <span id="desc-text">${truncatedDesc}</span>
                ${isLongDesc ? `<button onclick="toggleDescription('${encodeURIComponent(rawDesc)}', event)" id="desc-toggle-btn" class="ml-1 text-brand font-semibold text-xs hover:underline focus:outline-none inline-flex items-center">View More ▾</button>` : ''}
            </div>
        </div>` : ''}

        ${event["Moderator / Speaker / Participant"] ? `<div class="mb-6"><h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Speakers / Moderators</h3><div class="text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-line">${event["Moderator / Speaker / Participant"]}</div></div>` : ''}
        ${event["Company Name"] ? `<div class="mb-6"><h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Companies</h3><p class="text-sm text-slate-600 leading-relaxed">${event["Company Name"]}</p></div>` : ''}
        ${event.Tracks ? `<div class="pt-4 border-t border-slate-200/50 flex flex-wrap gap-2 mb-6">${event.Tracks.split(',').map(t => `<span class="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-[11px] uppercase tracking-wider font-bold rounded-md shadow-sm">${t.trim()}</span>`).join('')}</div>` : ''}

        <!-- Understand More CTA Section -->
        <div class="pt-4 border-t border-slate-200 pb-6">
            <button onclick="toggleResearchMenu()" class="w-full bg-brand hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-md">
                🔍 Understand More & Research Topic ▾
            </button>
            <div id="research-options" class="hidden mt-3 grid grid-cols-2 gap-2">
                <button onclick="openSearchEngine('google', '${topicQuery}')" class="bg-slate-100 hover:bg-slate-200 text-slate-800 py-2.5 px-2 rounded-lg text-xs font-semibold text-center transition flex items-center justify-center gap-1.5">
                    🌐 <span>Google</span>
                </button>
                <button onclick="openSearchEngine('chatgpt', '${topicQuery}')" class="bg-slate-100 hover:bg-slate-200 text-slate-800 py-2.5 px-2 rounded-lg text-xs font-semibold text-center transition flex items-center justify-center gap-1.5">
                    🤖 <span>ChatGPT</span>
                </button>
            </div>
        </div>
    `;

    drawerOverlay.classList.remove('hidden');
    setTimeout(() => {
        drawerOverlay.classList.remove('opacity-0');
        drawer.classList.remove('translate-y-full');
    }, 10);
}

function toggleDescription(encodedFullText, e) {
    if(e) e.stopPropagation();
    const fullText = decodeURIComponent(encodedFullText);
    const descTextEl = document.getElementById('desc-text');
    const toggleBtnEl = document.getElementById('desc-toggle-btn');
    const container = document.getElementById('desc-container');

    if (!descTextEl || !toggleBtnEl) return;

    const isExpanded = toggleBtnEl.getAttribute('data-expanded') === 'true';

    if (!isExpanded) {
        container.classList.add('max-h-32', 'overflow-y-auto', 'pr-2', 'bg-slate-50', 'p-2.5', 'rounded-lg', 'border', 'border-slate-100');
        descTextEl.innerText = fullText;
        toggleBtnEl.innerText = 'View Less ▴';
        toggleBtnEl.setAttribute('data-expanded', 'true');
        toggleBtnEl.className = 'block mt-2 text-brand font-semibold text-xs hover:underline focus:outline-none';
    } else {
        container.classList.remove('max-h-32', 'overflow-y-auto', 'pr-2', 'bg-slate-50', 'p-2.5', 'rounded-lg', 'border', 'border-slate-100');
        descTextEl.innerText = fullText.substring(0, 75) + '...';
        toggleBtnEl.innerText = 'View More ▾';
        toggleBtnEl.setAttribute('data-expanded', 'false');
        toggleBtnEl.className = 'ml-1 text-brand font-semibold text-xs hover:underline focus:outline-none inline-flex items-center';
    }
}

function toggleResearchMenu() {
    const menu = document.getElementById('research-options');
    if(menu) {
        menu.classList.toggle('hidden');
        if (!menu.classList.contains('hidden')) {
            const drawerBody = document.getElementById('drawer-content');
            if (drawerBody) {
                drawerBody.scrollTo({ top: drawerBody.scrollHeight, behavior: 'smooth' });
            }
        }
    }
}

function openSearchEngine(platform, encodedQuery) {
    const query = decodeURIComponent(encodedQuery);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    let webUrl = '';
    let appScheme = '';

    if (platform === 'google') {
        webUrl = `https://www.google.com/search?q=${encodedQuery}`;
        appScheme = `google://search?q=${encodedQuery}`;
    } else if (platform === 'chatgpt') {
        webUrl = `https://chatgpt.com/?q=${encodedQuery}`;
        appScheme = `chatgpt://`;
    }

    navigator.clipboard.writeText(query).then(() => {
        showToast(`Topic copied! Ready for ${platform.charAt(0).toUpperCase() + platform.slice(1)}`, "📋");
    }).catch(() => {
        console.log("Clipboard copy failed");
    });

    if (isMobile) {
        window.location.href = appScheme;
        setTimeout(() => {
            window.open(webUrl, '_blank');
        }, 600);
    } else {
        window.open(webUrl, '_blank');
    }
}

function closeDrawer() {
    if(drawerOverlay && drawer) {
        drawerOverlay.classList.add('opacity-0');
        drawer.classList.add('translate-y-full');
        setTimeout(() => drawerOverlay.classList.add('hidden'), 300);
    }
}