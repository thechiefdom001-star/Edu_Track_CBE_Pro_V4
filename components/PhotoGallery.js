import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { googleSheetSync } from '../lib/googleSheetSync.js';

const html = htm.bind(h);

export const PhotoGallery = ({ data, setData, onClose }) => {
    const [selectedGrade, setSelectedGrade] = useState('ALL');
    const [selectedStream, setSelectedStream] = useState('ALL');
    const [galleryPhotos, setGalleryPhotos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [syncStatus, setSyncStatus] = useState('');

    const grades = data?.settings?.grades || [];
    const streams = data?.settings?.streams || ['A', 'B', 'C'];

    // Load photos from storage
    useEffect(() => {
        loadGalleryPhotos();
    }, [selectedGrade, selectedStream]);

    const loadGalleryPhotos = () => {
        setLoading(true);
        try {
            const storedGallery = localStorage.getItem('et_photo_gallery');
            let photos = storedGallery ? JSON.parse(storedGallery) : [];

            // Filter by grade and stream
            if (selectedGrade !== 'ALL') {
                photos = photos.filter(p => p.grade === selectedGrade);
            }
            if (selectedStream !== 'ALL') {
                photos = photos.filter(p => p.stream === selectedStream);
            }

            setGalleryPhotos(photos);
        } catch (error) {
            console.error('[PhotoGallery] Load error:', error);
        } finally {
            setLoading(false);
        }
    };

    const savePhotoToGallery = (student) => {
        if (!student.portrait) return;

        try {
            const storedGallery = localStorage.getItem('et_photo_gallery');
            let photos = storedGallery ? JSON.parse(storedGallery) : [];

            // Check if photo already exists for this student
            const existingIndex = photos.findIndex(p => p.studentId === student.id);
            
            const photoEntry = {
                studentId: student.id,
                name: student.name,
                grade: student.grade,
                stream: student.stream,
                admissionNo: student.admissionNo,
                portrait: student.portrait,
                updatedAt: new Date().toISOString()
            };

            if (existingIndex >= 0) {
                photos[existingIndex] = photoEntry;
            } else {
                photos.push(photoEntry);
            }

            localStorage.setItem('et_photo_gallery', JSON.stringify(photos));
            loadGalleryPhotos();
            setSyncStatus('✓ Photo saved to gallery');
            setTimeout(() => setSyncStatus(''), 2000);
        } catch (error) {
            console.error('[PhotoGallery] Save error:', error);
            setSyncStatus('⚠ Failed to save photo');
            setTimeout(() => setSyncStatus(''), 2000);
        }
    };

    const syncGalleryToSheet = async () => {
        if (!data?.settings?.googleScriptUrl) {
            alert('Google Sheet not configured');
            return;
        }

        setLoading(true);
        setSyncStatus('Syncing gallery to cloud...');

        try {
            const storedGallery = localStorage.getItem('et_photo_gallery');
            const photos = storedGallery ? JSON.parse(storedGallery) : [];

            // Sync each photo individually to avoid URL length limits
            const results = [];
            for (const photo of photos) {
                const photoRecord = {
                    id: photo.studentId,
                    type: 'photo_gallery',
                    studentId: photo.studentId,
                    name: photo.name,
                    grade: photo.grade,
                    stream: photo.stream,
                    admissionNo: photo.admissionNo,
                    portrait: photo.portrait,
                    updatedAt: photo.updatedAt
                };

                googleSheetSync.setSettings(data.settings);
                // Use custom action for photo gallery
                const result = await googleSheetSync.pushRecord('Calendar', photoRecord, 'addPhotoGallery');
                results.push(result);
            }

            const successCount = results.filter(r => r.success).length;
            if (successCount === photos.length) {
                setSyncStatus(`✓ All ${photos.length} photos synced to cloud!`);
            } else {
                setSyncStatus(`⚠ Synced ${successCount}/${photos.length} photos`);
            }
        } catch (error) {
            console.error('[PhotoGallery] Sync error:', error);
            setSyncStatus('⚠ Sync error: ' + error.message);
        } finally {
            setLoading(false);
            setTimeout(() => setSyncStatus(''), 3000);
        }
    };

    const fetchGalleryFromSheet = async () => {
        if (!data?.settings?.googleScriptUrl) {
            alert('Google Sheet not configured');
            return;
        }

        setLoading(true);
        setSyncStatus('Fetching gallery from cloud...');

        try {
            googleSheetSync.setSettings(data.settings);
            const result = await googleSheetSync.fetchAll();

            if (result.success && result.calendar) {
                // Filter for photo gallery records
                const galleryPhotos = result.calendar
                    .filter(item => item.type === 'photo_gallery')
                    .map(item => ({
                        studentId: item.studentId,
                        name: item.name,
                        grade: item.grade,
                        stream: item.stream,
                        admissionNo: item.admissionNo,
                        portrait: item.portrait,
                        updatedAt: item.updatedAt
                    }));

                if (galleryPhotos.length > 0) {
                    localStorage.setItem('et_photo_gallery', JSON.stringify(galleryPhotos));
                    loadGalleryPhotos();
                    setSyncStatus(`✓ Fetched ${galleryPhotos.length} photos from cloud!`);
                } else {
                    setSyncStatus('⚠ No photos found in cloud');
                }
            } else {
                setSyncStatus('⚠ Failed to fetch from cloud');
            }
        } catch (error) {
            console.error('[PhotoGallery] Fetch error:', error);
            setSyncStatus('⚠ Fetch error: ' + error.message);
        } finally {
            setLoading(false);
            setTimeout(() => setSyncStatus(''), 3000);
        }
    };

    const clearGallery = () => {
        if (!confirm('Clear all photos from gallery? This cannot be undone.')) return;
        
        localStorage.removeItem('et_photo_gallery');
        setGalleryPhotos([]);
        setSyncStatus('✓ Gallery cleared');
        setTimeout(() => setSyncStatus(''), 2000);
    };

    const exportGallery = () => {
        const storedGallery = localStorage.getItem('et_photo_gallery');
        if (!storedGallery) {
            alert('No photos in gallery to export');
            return;
        }

        const photos = JSON.parse(storedGallery);
        const blob = new Blob([JSON.stringify(photos, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `photo-gallery-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const importGallery = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const photos = JSON.parse(event.target.result);
                if (!Array.isArray(photos)) {
                    throw new Error('Invalid gallery format');
                }

                localStorage.setItem('et_photo_gallery', JSON.stringify(photos));
                loadGalleryPhotos();
                setSyncStatus(`✓ Imported ${photos.length} photos`);
                setTimeout(() => setSyncStatus(''), 2000);
            } catch (error) {
                console.error('[PhotoGallery] Import error:', error);
                alert('Failed to import gallery. Invalid file format.');
            }
        };
        reader.readAsText(file);
    };

    const filteredStudents = data?.students?.filter(s => {
        const matchesGrade = selectedGrade === 'ALL' || s.grade === selectedGrade;
        const matchesStream = selectedStream === 'ALL' || s.stream === selectedStream;
        return matchesGrade && matchesStream;
    }) || [];

    return html`
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div class="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
                    <div class="flex justify-between items-center">
                        <div>
                            <h2 class="text-2xl font-bold">📸 Student Photo Gallery</h2>
                            <p class="text-blue-100 text-sm mt-1">
                                ${galleryPhotos.length} photos stored locally
                            </p>
                        </div>
                        <button 
                            onClick=${onClose}
                            class="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div class="p-6 border-b bg-gray-50">
                    <div class="flex flex-wrap gap-4 items-center">
                        <div>
                            <label class="block text-xs font-bold text-gray-600 mb-1">Grade</label>
                            <select 
                                class="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                value=${selectedGrade}
                                onChange=${(e) => setSelectedGrade(e.target.value)}
                            >
                                <option value="ALL">All Grades</option>
                                ${grades.map(g => html`<option value=${g}>${g}</option>`)}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-600 mb-1">Stream</label>
                            <select 
                                class="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                value=${selectedStream}
                                onChange=${(e) => setSelectedStream(e.target.value)}
                            >
                                <option value="ALL">All Streams</option>
                                ${streams.map(s => html`<option value=${s}>Stream ${s}</option>`)}
                            </select>
                        </div>
                        <div class="flex gap-2 ml-auto">
                            <button
                                onClick=${fetchGalleryFromSheet}
                                class="bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-cyan-700"
                            >
                                ☁️ Fetch from Cloud
                            </button>
                            <button
                                onClick=${exportGallery}
                                class="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                            >
                                📥 Export
                            </button>
                            <label class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer">
                                📤 Import
                                <input type="file" accept=".json" onChange=${importGallery} class="hidden" />
                            </label>
                            <button
                                onClick=${syncGalleryToSheet}
                                class="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700"
                            >
                                ☁️ Sync to Cloud
                            </button>
                            <button
                                onClick=${clearGallery}
                                class="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"
                            >
                                🗑️ Clear
                            </button>
                        </div>
                    </div>
                    ${syncStatus && html`
                        <div class="mt-3 text-sm font-medium ${syncStatus.includes('✓') ? 'text-green-600' : 'text-red-600'}">
                            ${syncStatus}
                        </div>
                    `}
                </div>

                <div class="flex-1 overflow-auto p-6">
                    ${loading ? html`
                        <div class="text-center py-12">
                            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p class="mt-2 text-gray-600">Loading...</p>
                        </div>
                    ` : galleryPhotos.length === 0 ? html`
                        <div class="text-center py-12 bg-gray-50 rounded-lg">
                            <p class="text-gray-500 text-lg">No photos in gallery</p>
                            <p class="text-gray-400 text-sm mt-2">Add students with photos to build your gallery</p>
                        </div>
                    ` : html`
                        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            ${galleryPhotos.map(photo => html`
                                <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                                    <div class="aspect-[3/4] bg-gray-100">
                                        <img 
                                            src=${photo.portrait} 
                                            alt=${photo.name}
                                            class="w-full h-full object-cover"
                                            onError=${(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23ccc" width="100" height="100"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23666">No Image</text></svg>'; }}
                                        />
                                    </div>
                                    <div class="p-2">
                                        <p class="font-bold text-xs text-gray-800 truncate">${photo.name}</p>
                                        <p class="text-xs text-gray-500">${photo.grade} - ${photo.stream || 'N/A'}</p>
                                        <p class="text-xs text-gray-400">${photo.admissionNo || 'No Adm No'}</p>
                                    </div>
                                </div>
                            `)}
                        </div>
                    `}
                </div>

                <div class="p-4 border-t bg-gray-50">
                    <div class="flex justify-between items-center text-sm text-gray-600">
                        <div>
                            <span class="font-bold">Tip:</span> Photos are stored locally. Use "Sync to Cloud" to backup.
                        </div>
                        <button 
                            onClick=${onClose}
                            class="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-300"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
};

export default PhotoGallery;
