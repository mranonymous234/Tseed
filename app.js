// Initialize Supabase
const supabaseUrl = 'https://xtvkckwcnyrgkzbarkft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dmtja3djbnlyZ2t6YmFya2Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc2NjUxMTUsImV4cCI6MjA2MzI0MTExNX0.3Ot2oQyEwxW7sbccS1RWzGzK-UipxcgxqUadQ8oe9T0';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Initialize WebTorrent
const client = new WebTorrent();

// DOM elements
const authContainer = document.getElementById('auth-container');
const userInfoDiv = document.getElementById('user-info');
const userEmailSpan = document.getElementById('user-email');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const googleLoginBtn = document.getElementById('google-login');
const appleLoginBtn = document.getElementById('apple-login');
const appContent = document.getElementById('app-content');
const torrentFileInput = document.getElementById('torrent-file');
const torrentInfoDiv = document.getElementById('torrent-info');
const saveButton = document.getElementById('save-metadata');
const startDownloadButton = document.getElementById('start-download');
const savedTorrentsDiv = document.getElementById('saved-torrents');
const activeDownloadsDiv = document.getElementById('active-downloads');

// Current torrent data
let currentTorrentMetadata = null;
let currentTorrentFile = null;
let currentUser = null;

// Event listeners
torrentFileInput.addEventListener('change', handleTorrentUpload);
saveButton.addEventListener('click', saveTorrentMetadata);
startDownloadButton.addEventListener('click', startDownload);
loginBtn.addEventListener('click', handleLogin);
signupBtn.addEventListener('click', handleSignup);
logoutBtn.addEventListener('click', handleLogout);
googleLoginBtn.addEventListener('click', handleGoogleLogin);
appleLoginBtn.addEventListener('click', handleAppleLogin);

// Check session on load
checkSession();

// Check user session
async function checkSession() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        currentUser = user;
        showAppContent();
        loadSavedTorrents();
    }
}

// Show app content when authenticated
function showAppContent() {
    loginForm.classList.add('hidden');
    userInfoDiv.classList.remove('hidden');
    appContent.classList.remove('hidden');
    userEmailSpan.textContent = currentUser.email;
}

// Handle login
async function handleLogin() {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) {
        alert(error.message);
        return;
    }
    
    currentUser = data.user;
    showAppContent();
    loadSavedTorrents();
}

// Handle signup
async function handleSignup() {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    const { data, error } = await supabase.auth.signUp({
        email,
        password
    });
    
    if (error) {
        alert(error.message);
        return;
    }
    
    alert('Signup successful! Please check your email for confirmation.');
}

// Handle Google login
async function handleGoogleLogin() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });
    
    if (error) {
        alert(error.message);
    }
}

// Handle Apple login
async function handleAppleLogin() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
            redirectTo: window.location.origin
        }
    });
    
    if (error) {
        alert(error.message);
    }
}

// Handle logout
async function handleLogout() {
    await supabase.auth.signOut();
    currentUser = null;
    loginForm.classList.remove('hidden');
    userInfoDiv.classList.add('hidden');
    appContent.classList.add('hidden');
    emailInput.value = '';
    passwordInput.value = '';
}

// Handle torrent file upload
async function handleTorrentUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    currentTorrentFile = file;
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const torrentData = bencode.decode(new Uint8Array(arrayBuffer));
        
        // Extract metadata
        const info = torrentData.info;
        const name = info.name?.toString() || 'Unnamed';
        const hash = await calculateInfoHash(info);
        
        // Calculate total size
        let totalSize = 0;
        let fileCount = 0;
        const fileList = [];
        
        if (info.files) {
            // Multi-file torrent
            fileCount = info.files.length;
            info.files.forEach(file => {
                const filePath = file.path.map(p => p.toString()).join('/');
                const fileSize = file.length;
                totalSize += fileSize;
                fileList.push({ path: filePath, size: formatSize(fileSize) });
            });
        } else {
            // Single file torrent
            fileCount = 1;
            totalSize = info.length;
            fileList.push({ path: name, size: formatSize(totalSize) });
        }
        
        // Display metadata
        document.getElementById('torrent-name').textContent = name;
        document.getElementById('torrent-size').textContent = formatSize(totalSize);
        document.getElementById('torrent-hash').textContent = hash;
        document.getElementById('file-count').textContent = fileCount;
        
        // Display file list
        const fileListDiv = document.getElementById('file-list');
        fileListDiv.innerHTML = '';
        fileList.forEach(file => {
            const fileDiv = document.createElement('div');
            fileDiv.innerHTML = `<strong>${file.path}</strong> (${file.size})`;
            fileListDiv.appendChild(fileDiv);
        });
        
        torrentInfoDiv.classList.remove('hidden');
        
        // Store current torrent data for saving
        currentTorrentMetadata = {
            name,
            hash,
            size: totalSize,
            file_count: fileCount,
            files: fileList,
            created_at: new Date().toISOString(),
            user_id: currentUser.id
        };
        
    } catch (error) {
        console.error('Error parsing torrent file:', error);
        alert('Error parsing torrent file. Please make sure it\'s a valid .torrent file.');
    }
}

// Start downloading the torrent
function startDownload() {
    if (!currentTorrentFile) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const torrentId = reader.result;
        
        client.add(torrentId, torrent => {
            // Create download element
            const torrentElement = document.createElement('div');
            torrentElement.className = 'active-torrent';
            torrentElement.id = `torrent-${torrent.infoHash}`;
            torrentElement.innerHTML = `
                <h3>${torrent.name}</h3>
                <p>Downloading: <progress value="0" max="100"></progress></p>
                <p>Peers: <span class="peers">0</span></p>
                <p>Download speed: <span class="download-speed">0</span> KB/s</p>
                <p>Upload speed: <span class="upload-speed">0</span> KB/s</p>
                <button class="secondary stop-download" data-infohash="${torrent.infoHash}">Stop Download</button>
            `;
            activeDownloadsDiv.appendChild(torrentElement);
            
            // Add event listener for stop button
            torrentElement.querySelector('.stop-download').addEventListener('click', () => {
                client.remove(torrent);
                torrentElement.remove();
            });
            
            // Update progress
            torrent.on('download', bytes => {
                const progress = (torrent.progress * 100).toFixed(1);
                const element = document.getElementById(`torrent-${torrent.infoHash}`);
                if (element) {
                    element.querySelector('progress').value = progress;
                    element.querySelector('.peers').textContent = torrent.numPeers;
                    element.querySelector('.download-speed').textContent = 
                        (torrent.downloadSpeed / 1024).toFixed(1);
                    element.querySelector('.upload-speed').textContent = 
                        (torrent.uploadSpeed / 1024).toFixed(1);
                }
            });
            
            // When download is complete
            torrent.on('done', () => {
                const element = document.getElementById(`torrent-${torrent.infoHash}`);
                if (element) {
                    element.querySelector('progress').value = 100;
                    element.innerHTML += '<p>Download complete!</p>';
                    
                    // Create download links for each file
                    torrent.files.forEach(file => {
                        file.getBlobURL((err, url) => {
                            if (err) return console.error(err);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = file.name;
                            link.textContent = `Download ${file.name}`;
                            link.className = 'secondary';
                            element.appendChild(link);
                            element.appendChild(document.createElement('br'));
                        });
                    });
                }
            });
        });
    };
    reader.readAsDataURL(currentTorrentFile);
}

// Save torrent metadata to Supabase
async function saveTorrentMetadata() {
    if (!currentTorrentMetadata) return;
    
    try {
        const { data, error } = await supabase
            .from('torrents')
            .insert([currentTorrentMetadata]);
        
        if (error) throw error;
        
        alert('Torrent metadata saved successfully!');
        loadSavedTorrents();
    } catch (error) {
        console.error('Error saving torrent metadata:', error);
        alert('Error saving torrent metadata.');
    }
}

// Load saved torrents from Supabase
async function loadSavedTorrents() {
    if (!currentUser) return;
    
    try {
        const { data, error } = await supabase
            .from('torrents')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        savedTorrentsDiv.innerHTML = '';
        
        if (data.length === 0) {
            savedTorrentsDiv.innerHTML = '<p>No saved torrents found.</p>';
            return;
        }
        
        data.forEach(torrent => {
            const torrentDiv = document.createElement('div');
            torrentDiv.className = 'torrent-card';
            torrentDiv.innerHTML = `
                <h3>${torrent.name}</h3>
                <p><strong>Hash:</strong> ${torrent.hash}</p>
                <p><strong>Size:</strong> ${formatSize(torrent.size)}</p>
                <p><strong>Files:</strong> ${torrent.file_count}</p>
                <small>Saved on: ${new Date(torrent.created_at).toLocaleString()}</small>
                <div class="torrent-actions">
                    <button class="secondary download-saved" data-hash="${torrent.hash}" data-name="${torrent.name}">Download</button>
                    <button class="secondary delete-torrent" data-id="${torrent.id}">Delete</button>
                </div>
            `;
            savedTorrentsDiv.appendChild(torrentDiv);
            
            // Add event listener for download button
            torrentDiv.querySelector('.download-saved').addEventListener('click', (e) => {
                const hash = e.target.dataset.hash;
                const name = e.target.dataset.name;
                downloadFromMagnetLink(hash, name);
            });
            
            // Add event listener for delete button
            torrentDiv.querySelector('.delete-torrent').addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                if (confirm('Are you sure you want to delete this torrent?')) {
                    await deleteTorrent(id);
                }
            });
        });
    } catch (error) {
        console.error('Error loading saved torrents:', error);
        savedTorrentsDiv.innerHTML = '<p>Error loading saved torrents.</p>';
    }
}

// Delete a torrent from Supabase
async function deleteTorrent(id) {
    try {
        const { error } = await supabase
            .from('torrents')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        loadSavedTorrents();
    } catch (error) {
        console.error('Error deleting torrent:', error);
        alert('Error deleting torrent.');
    }
}

// Download from magnet link
function downloadFromMagnetLink(hash, name) {
    const magnetLink = `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(name)}`;
    
    client.add(magnetLink, torrent => {
        // Create download element
        const torrentElement = document.createElement('div');
        torrentElement.className = 'active-torrent';
        torrentElement.id = `torrent-${torrent.infoHash}`;
        torrentElement.innerHTML = `
            <h3>${torrent.name}</h3>
            <p>Downloading: <progress value="0" max="100"></progress></p>
            <p>Peers: <span class="peers">0</span></p>
            <p>Download speed: <span class="download-speed">0</span> KB/s</p>
            <p>Upload speed: <span class="upload-speed">0</span> KB/s</p>
            <button class="secondary stop-download" data-infohash="${torrent.infoHash}">Stop Download</button>
        `;
        activeDownloadsDiv.appendChild(torrentElement);
        
        // Add event listener for stop button
        torrentElement.querySelector('.stop-download').addEventListener('click', () => {
            client.remove(torrent);
            torrentElement.remove();
        });
        
        // Update progress
        torrent.on('download', bytes => {
            const progress = (torrent.progress * 100).toFixed(1);
            const element = document.getElementById(`torrent-${torrent.infoHash}`);
            if (element) {
                element.querySelector('progress').value = progress;
                element.querySelector('.peers').textContent = torrent.numPeers;
                element.querySelector('.download-speed').textContent = 
                    (torrent.downloadSpeed / 1024).toFixed(1);
                element.querySelector('.upload-speed').textContent = 
                    (torrent.uploadSpeed / 1024).toFixed(1);
            }
        });
        
        // When download is complete
        torrent.on('done', () => {
            const element = document.getElementById(`torrent-${torrent.infoHash}`);
            if (element) {
                element.querySelector('progress').value = 100;
                element.innerHTML += '<p>Download complete!</p>';
                
                // Create download links for each file
                torrent.files.forEach(file => {
                    file.getBlobURL((err, url) => {
                        if (err) return console.error(err);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = file.name;
                        link.textContent = `Download ${file.name}`;
                        link.className = 'secondary';
                        element.appendChild(link);
                        element.appendChild(document.createElement('br'));
                    });
                });
            }
        });
    });
}

// Calculate SHA-1 hash of the info dictionary
async function calculateInfoHash(info) {
    const encodedInfo = bencode.encode(info);
    const hashBuffer = await crypto.subtle.digest('SHA-1', encodedInfo);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Format file size in human-readable format
function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
