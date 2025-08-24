const {
    ensureDirectories,
    cleanupOldFiles,
    formatFileSize,
    getDirectorySize,
    safeDelete,
    isAudioFile,
    sanitizeFilename,
    getDiskSpace
} = require('../../utils/fileUtils');

const fs = require('fs').promises;
const path = require('path');

// Mock fs promises
jest.mock('fs/promises');

// Mock child_process for getDiskSpace
jest.mock('child_process');
const { exec } = require('child_process');

describe('FileUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('ensureDirectories', () => {
        test('should create missing directories', async () => {
            fs.access.mockRejectedValue(new Error('Directory not found'));
            fs.mkdir.mockResolvedValue();

            await ensureDirectories();

            expect(fs.mkdir).toHaveBeenCalledWith(
                expect.stringContaining('uploads'),
                { recursive: true }
            );
            expect(fs.mkdir).toHaveBeenCalledWith(
                expect.stringContaining('outputs'),
                { recursive: true }
            );
            expect(fs.mkdir).toHaveBeenCalledWith(
                expect.stringContaining('logs'),
                { recursive: true }
            );
        });

        test('should skip creation for existing directories', async () => {
            fs.access.mockResolvedValue(); // Directory exists
            fs.mkdir.mockResolvedValue();

            await ensureDirectories();

            expect(fs.mkdir).not.toHaveBeenCalled();
        });

        test('should use environment variables for directory paths', async () => {
            process.env.UPLOAD_DIR = 'custom-uploads';
            process.env.OUTPUT_DIR = 'custom-outputs';

            fs.access.mockRejectedValue(new Error('Directory not found'));
            fs.mkdir.mockResolvedValue();

            await ensureDirectories();

            expect(fs.mkdir).toHaveBeenCalledWith(
                expect.stringContaining('custom-uploads'),
                { recursive: true }
            );
            expect(fs.mkdir).toHaveBeenCalledWith(
                expect.stringContaining('custom-outputs'),
                { recursive: true }
            );

            // Cleanup environment variables
            delete process.env.UPLOAD_DIR;
            delete process.env.OUTPUT_DIR;
        });
    });

    describe('cleanupOldFiles', () => {
        test('should remove files older than specified age', async () => {
            const now = Date.now();
            const oldTime = now - (25 * 60 * 60 * 1000); // 25 hours ago
            const recentTime = now - (1 * 60 * 60 * 1000); // 1 hour ago

            fs.readdir.mockResolvedValue(['old-file.mp3', 'recent-file.wav']);
            fs.stat
                .mockResolvedValueOnce({ mtime: new Date(oldTime) })
                .mockResolvedValueOnce({ mtime: new Date(recentTime) });
            fs.unlink.mockResolvedValue();

            const result = await cleanupOldFiles('uploads', 24);

            expect(result).toBe(1);
            expect(fs.unlink).toHaveBeenCalledWith(
                expect.stringContaining('old-file.mp3')
            );
            expect(fs.unlink).not.toHaveBeenCalledWith(
                expect.stringContaining('recent-file.wav')
            );
        });

        test('should handle file stat errors gracefully', async () => {
            fs.readdir.mockResolvedValue(['problematic-file.mp3']);
            fs.stat.mockRejectedValue(new Error('Cannot stat file'));

            const result = await cleanupOldFiles('uploads', 24);

            expect(result).toBe(0);
            expect(fs.unlink).not.toHaveBeenCalled();
        });

        test('should handle directory read errors', async () => {
            fs.readdir.mockRejectedValue(new Error('Directory not found'));

            const result = await cleanupOldFiles('non-existent', 24);

            expect(result).toBe(0);
        });

        test('should continue cleanup even if some files fail to delete', async () => {
            const now = Date.now();
            const oldTime = now - (25 * 60 * 60 * 1000);

            fs.readdir.mockResolvedValue(['file1.mp3', 'file2.wav']);
            fs.stat.mockResolvedValue({ mtime: new Date(oldTime) });
            fs.unlink
                .mockRejectedValueOnce(new Error('Cannot delete file1'))
                .mockResolvedValueOnce();

            const result = await cleanupOldFiles('uploads', 24);

            expect(result).toBe(1);
            expect(fs.unlink).toHaveBeenCalledTimes(2);
        });
    });

    describe('formatFileSize', () => {
        test('should format bytes correctly', () => {
            expect(formatFileSize(0)).toBe('0 Bytes');
            expect(formatFileSize(1024)).toBe('1 KB');
            expect(formatFileSize(1048576)).toBe('1 MB');
            expect(formatFileSize(1073741824)).toBe('1 GB');
            expect(formatFileSize(1500)).toBe('1.46 KB');
            expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
        });

        test('should handle large numbers', () => {
            expect(formatFileSize(1099511627776)).toBe('1 TB');
            expect(formatFileSize(5.7 * 1024 * 1024 * 1024)).toBe('5.7 GB');
        });

        test('should handle decimal precision', () => {
            expect(formatFileSize(1536)).toBe('1.5 KB');
            expect(formatFileSize(1536000)).toBe('1.46 MB');
        });
    });

    describe('getDirectorySize', () => {
        test('should calculate total size of files in directory', async () => {
            fs.readdir.mockResolvedValue(['file1.mp3', 'file2.wav', 'subdir']);
            fs.stat
                .mockResolvedValueOnce({ isDirectory: () => false, size: 1024 })
                .mockResolvedValueOnce({ isDirectory: () => false, size: 2048 })
                .mockResolvedValueOnce({ isDirectory: () => true, size: 0 });

            // Mock recursive call for subdirectory
            fs.readdir.mockResolvedValueOnce(['file3.flac']);
            fs.stat.mockResolvedValueOnce({ isDirectory: () => false, size: 512 });

            const result = await getDirectorySize('/test/directory');

            expect(result).toBe(3584); // 1024 + 2048 + 512
        });

        test('should handle empty directories', async () => {
            fs.readdir.mockResolvedValue([]);

            const result = await getDirectorySize('/empty/directory');

            expect(result).toBe(0);
        });

        test('should handle directory read errors', async () => {
            fs.readdir.mockRejectedValue(new Error('Permission denied'));

            const result = await getDirectorySize('/restricted/directory');

            expect(result).toBe(0);
        });

        test('should skip files that cannot be stat\'d', async () => {
            fs.readdir.mockResolvedValue(['good-file.mp3', 'bad-file.wav']);
            fs.stat
                .mockResolvedValueOnce({ isDirectory: () => false, size: 1024 })
                .mockRejectedValueOnce(new Error('Cannot stat file'));

            const result = await getDirectorySize('/test/directory');

            expect(result).toBe(1024);
        });
    });

    describe('safeDelete', () => {
        test('should delete files successfully', async () => {
            fs.stat.mockResolvedValue({ isDirectory: () => false });
            fs.unlink.mockResolvedValue();

            const result = await safeDelete('/test/file.mp3');

            expect(result).toBe(true);
            expect(fs.unlink).toHaveBeenCalledWith('/test/file.mp3');
        });

        test('should delete directories successfully', async () => {
            fs.stat.mockResolvedValue({ isDirectory: () => true });
            fs.rmdir.mockResolvedValue();

            const result = await safeDelete('/test/directory');

            expect(result).toBe(true);
            expect(fs.rmdir).toHaveBeenCalledWith('/test/directory', { recursive: true });
        });

        test('should handle non-existent files gracefully', async () => {
            const error = new Error('File not found');
            error.code = 'ENOENT';
            fs.stat.mockRejectedValue(error);

            const result = await safeDelete('/non/existent/file');

            expect(result).toBe(false);
            expect(fs.unlink).not.toHaveBeenCalled();
        });

        test('should handle permission errors', async () => {
            fs.stat.mockResolvedValue({ isDirectory: () => false });
            fs.unlink.mockRejectedValue(new Error('Permission denied'));

            const result = await safeDelete('/restricted/file');

            expect(result).toBe(false);
        });
    });

    describe('isAudioFile', () => {
        test('should identify audio files correctly', () => {
            const audioFiles = [
                'song.mp3',
                'track.wav',
                'music.flac',
                'audio.m4a',
                'sound.aac',
                'recording.ogg',
                'voice.wma',
                'video.mp4' // Can contain audio
            ];

            audioFiles.forEach(filename => {
                expect(isAudioFile(filename)).toBe(true);
            });
        });

        test('should reject non-audio files', () => {
            const nonAudioFiles = [
                'document.txt',
                'image.jpg',
                'video.avi',
                'archive.zip',
                'script.js',
                'style.css',
                'data.json'
            ];

            nonAudioFiles.forEach(filename => {
                expect(isAudioFile(filename)).toBe(false);
            });
        });

        test('should be case insensitive', () => {
            expect(isAudioFile('SONG.MP3')).toBe(true);
            expect(isAudioFile('Track.WAV')).toBe(true);
            expect(isAudioFile('music.FLAC')).toBe(true);
        });

        test('should handle files without extensions', () => {
            expect(isAudioFile('audiofile')).toBe(false);
            expect(isAudioFile('')).toBe(false);
        });
    });

    describe('sanitizeFilename', () => {
        test('should remove unsafe characters', () => {
            const unsafeFilename = 'song<>:"/\\|?*.mp3';
            const result = sanitizeFilename(unsafeFilename);
            
            expect(result).not.toMatch(/[<>:"/\\|?*]/);
            expect(result).toBe('song_.mp3');
        });

        test('should replace spaces with underscores', () => {
            const filename = 'my favorite song.mp3';
            const result = sanitizeFilename(filename);
            
            expect(result).toBe('my_favorite_song.mp3');
        });

        test('should remove multiple consecutive underscores', () => {
            const filename = 'song___with___spaces.mp3';
            const result = sanitizeFilename(filename);
            
            expect(result).toBe('song_with_spaces.mp3');
        });

        test('should remove leading and trailing underscores', () => {
            const filename = '___song___.mp3';
            const result = sanitizeFilename(filename);
            
            expect(result).toBe('song.mp3');
        });

        test('should limit filename length', () => {
            const longFilename = 'a'.repeat(300) + '.mp3';
            const result = sanitizeFilename(longFilename);
            
            expect(result.length).toBeLessThanOrEqual(255);
        });

        test('should handle empty strings', () => {
            expect(sanitizeFilename('')).toBe('');
            expect(sanitizeFilename('   ')).toBe('');
        });

        test('should preserve valid filenames', () => {
            const validFilename = 'normal_song_123.mp3';
            const result = sanitizeFilename(validFilename);
            
            expect(result).toBe(validFilename);
        });
    });

    describe('getDiskSpace', () => {
        beforeEach(() => {
            exec.mockClear();
        });

        test('should get disk space on Windows', async () => {
            // Mock Windows platform
            Object.defineProperty(process, 'platform', { value: 'win32' });

            exec.mockImplementation((command, callback) => {
                const mockOutput = `
FreeSpace=50000000000
Size=100000000000
`;
                callback(null, { stdout: mockOutput });
            });

            const result = await getDiskSpace('C:\\test');

            expect(result).toEqual({
                total: 100000000000,
                free: 50000000000,
                used: 50000000000,
                usedPercentage: 50
            });
        });

        test('should get disk space on Unix/Linux', async () => {
            // Mock Unix platform
            Object.defineProperty(process, 'platform', { value: 'linux' });

            exec.mockImplementation((command, callback) => {
                const mockOutput = `Filesystem     1K-blocks    Used Available Use% Mounted on
/dev/sda1       97619952 48809976  43787700  53% /`;
                callback(null, { stdout: mockOutput });
            });

            const result = await getDiskSpace('/test');

            expect(result).toEqual({
                total: 97619952 * 1024,
                free: 43787700 * 1024,
                used: 48809976 * 1024,
                usedPercentage: 50
            });
        });

        test('should handle command execution errors', async () => {
            exec.mockImplementation((command, callback) => {
                callback(new Error('Command failed'));
            });

            const result = await getDiskSpace('/test');

            expect(result).toBeNull();
        });

        test('should handle malformed output', async () => {
            exec.mockImplementation((command, callback) => {
                callback(null, { stdout: 'Invalid output format' });
            });

            const result = await getDiskSpace('/test');

            expect(result).toBeNull();
        });
    });
});
