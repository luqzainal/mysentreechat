import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api'; // Instance Axios
import { useAuth } from '../contexts/AuthContext';
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trash2, UploadCloud, FileImage, Video } from 'lucide-react'; // Import ikon
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

// Fungsi helper untuk format saiz fail
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const MediaStoragePage = () => {
  const [mediaList, setMediaList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const { user } = useAuth();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'; // Dapatkan base URL API

  // Fetch senarai media
  const fetchMedia = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/media');
      setMediaList(response.data);
    } catch (error) {
      console.error("Failed to get media list:", error);
      toast.error("Failed to load media list.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMedia();
    }
  }, [user]);

  // Kendalikan pemilihan fail
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
       // Validate file size (e.g., 10MB)
       if (file.size > 10 * 1024 * 1024) {
            toast.error("File size exceeds the 10MB limit.");
            setSelectedFile(null);
            if(fileInputRef.current) fileInputRef.current.value = null; // Reset input
            return;
        }
        // Validate file type (if necessary, although backend validates)
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            toast.error("Only image or video files are allowed.");
             setSelectedFile(null);
             if(fileInputRef.current) fileInputRef.current.value = null; // Reset input
            return;
        }
      setSelectedFile(file);
    }
  };

  // Kendalikan muat naik fail
  const handleUpload = async () => {
    if (!selectedFile) {
      toast.warning("Please select a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append('mediaFile', selectedFile);

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const response = await api.post('/api/media/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });
      
      // Add new media to the list (without re-fetching everything)
      setMediaList(prevList => [response.data, ...prevList]);
      toast.success(`File ${response.data.originalName} uploaded successfully.`);
      setSelectedFile(null); // Reset file selection
      if(fileInputRef.current) fileInputRef.current.value = null; // Reset file input

    } catch (error) {
      console.error("Failed to upload file:", error);
      const errorMessage = error.response?.data?.message || "Error during file upload.";
      toast.error(`Upload failed: ${errorMessage}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Kendalikan pemadaman fail
  const handleDelete = async (mediaId) => {
    try {
      await api.delete(`/api/media/${mediaId}`);
      // Remove item from state
      setMediaList(prevList => prevList.filter(media => media._id !== mediaId));
      toast.success("Media file deleted successfully.");
    } catch (error) {
      console.error("Failed to delete media file:", error);
       const errorMessage = error.response?.data?.message || "Error deleting file.";
      toast.error(`Delete failed: ${errorMessage}`);
    }
  };

  // Pilih ikon berdasarkan jenis fail
  const getFileIcon = (fileType) => {
      if (fileType.startsWith('image/')) return <FileImage className="h-8 w-8 text-muted-foreground" />;
      if (fileType.startsWith('video/')) return <Video className="h-8 w-8 text-muted-foreground" />;
      return null; // Or a generic file icon
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload New Media</CardTitle>
          <CardDescription>Select an image or video file (max 10MB).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,video/*" // Only allow images & videos
            disabled={isUploading}
          />
          {selectedFile && (
            <p className="text-sm text-muted-foreground">
              File selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
            </p>
          )}
          {isUploading && (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">Uploading: {uploadProgress}%</p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleUpload} disabled={isUploading || !selectedFile}>
             <UploadCloud className="mr-2 h-4 w-4" /> 
            {isUploading ? 'Uploading...' : 'Upload File'}
          </Button>
        </CardFooter>
      </Card>

      {/* Media List Section */}
      <Card>
        <CardHeader>
          <CardTitle>Stored Media</CardTitle>
          <CardDescription>List of media files you have uploaded.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
               {[...Array(4)].map((_, i) => ( // Display some skeletons
                    <Skeleton key={i} className="aspect-square w-full" />
               ))}
            </div>
          ) : mediaList.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No media files found.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {mediaList.map((media) => (
                <Card key={media._id} className="overflow-hidden group relative">
                  <CardContent className="p-0 aspect-square flex items-center justify-center bg-muted">
                    {media.fileType.startsWith('image/') ? (
                      <img 
                        src={`${API_URL}${media.filePath}`} 
                        alt={media.originalName}
                        className="object-cover w-full h-full"
                        onError={(e) => { e.target.onerror = null; e.target.src="/placeholder.png"; }} // Fallback if image is broken
                      />
                    ) : media.fileType.startsWith('video/') ? (
                      <video 
                        // src={`${API_URL}${media.filePath}`} 
                        // controls 
                        className="object-cover w-full h-full bg-black flex items-center justify-center"
                        // Poster can be added if thumbnails are available
                      >
                        <source src={`${API_URL}${media.filePath}`} type={media.fileType} />
                        Your browser does not support the video tag.
                        {/* Video icon as fallback if video cannot play */} 
                         <Video className="h-16 w-16 text-white absolute" />
                      </video>
                    ) : (
                      <div className="p-4">{getFileIcon(media.fileType)}</div>
                    )}
                     {/* Overlay for info & delete button */} 
                     <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2 text-white">
                        <div className="text-xs break-words">
                           <p className="font-semibold">{media.originalName}</p>
                           <p>{formatBytes(media.fileSize)}</p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="destructive" size="icon" className="self-end w-8 h-8">
                                <Trash2 className="h-4 w-4" />
                             </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Media File?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action will permanently delete the file '{media.originalName}'.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(media._id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                     </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MediaStoragePage; 