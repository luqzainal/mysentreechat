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
      const response = await api.get('/media');
      setMediaList(response.data);
    } catch (error) {
      console.error("Gagal mendapatkan senarai media:", error);
      toast.error("Gagal memuatkan senarai media.");
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
       // Validasi saiz fail (contoh 10MB)
       if (file.size > 10 * 1024 * 1024) {
            toast.error("Saiz fail melebihi had 10MB.");
            setSelectedFile(null);
            if(fileInputRef.current) fileInputRef.current.value = null; // Reset input
            return;
        }
        // Validasi jenis fail (jika perlu, walaupun backend ada)
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            toast.error("Hanya fail imej atau video dibenarkan.");
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
      toast.warning("Sila pilih fail untuk dimuat naik.");
      return;
    }

    const formData = new FormData();
    formData.append('mediaFile', selectedFile);

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const response = await api.post('/media/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });
      
      // Tambah media baru ke senarai (tanpa fetch semula semua)
      setMediaList(prevList => [response.data, ...prevList]);
      toast.success(`Fail ${response.data.originalName} berjaya dimuat naik.`);
      setSelectedFile(null); // Reset pilihan fail
      if(fileInputRef.current) fileInputRef.current.value = null; // Reset input file

    } catch (error) {
      console.error("Gagal memuat naik fail:", error);
      const errorMessage = error.response?.data?.message || "Ralat semasa memuat naik fail.";
      toast.error(`Muat naik gagal: ${errorMessage}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Kendalikan pemadaman fail
  const handleDelete = async (mediaId) => {
    try {
      await api.delete(`/media/${mediaId}`);
      // Buang item dari state
      setMediaList(prevList => prevList.filter(media => media._id !== mediaId));
      toast.success("Fail media berjaya dipadam.");
    } catch (error) {
      console.error("Gagal memadam fail media:", error);
       const errorMessage = error.response?.data?.message || "Ralat semasa memadam fail.";
      toast.error(`Gagal memadam: ${errorMessage}`);
    }
  };

  // Pilih ikon berdasarkan jenis fail
  const getFileIcon = (fileType) => {
      if (fileType.startsWith('image/')) return <FileImage className="h-8 w-8 text-muted-foreground" />;
      if (fileType.startsWith('video/')) return <Video className="h-8 w-8 text-muted-foreground" />;
      return null; // Atau ikon fail generik
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Bahagian Muat Naik */}
      <Card>
        <CardHeader>
          <CardTitle>Muat Naik Media Baru</CardTitle>
          <CardDescription>Pilih fail imej atau video (maks 10MB).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,video/*" // Hanya benarkan imej & video
            disabled={isUploading}
          />
          {selectedFile && (
            <p className="text-sm text-muted-foreground">
              Fail dipilih: {selectedFile.name} ({formatBytes(selectedFile.size)})
            </p>
          )}
          {isUploading && (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">Memuat naik: {uploadProgress}%</p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleUpload} disabled={isUploading || !selectedFile}>
             <UploadCloud className="mr-2 h-4 w-4" /> 
            {isUploading ? 'Sedang Memuat Naik...' : 'Muat Naik Fail'}
          </Button>
        </CardFooter>
      </Card>

      {/* Bahagian Senarai Media */}
      <Card>
        <CardHeader>
          <CardTitle>Media Tersimpan</CardTitle>
          <CardDescription>Senarai fail media yang telah anda muat naik.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
               {[...Array(4)].map((_, i) => ( // Papar beberapa skeleton
                    <Skeleton key={i} className="aspect-square w-full" />
               ))}
            </div>
          ) : mediaList.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Tiada fail media ditemui.</p>
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
                        onError={(e) => { e.target.onerror = null; e.target.src="/placeholder.png"; }} // Fallback jika imej rosak
                      />
                    ) : media.fileType.startsWith('video/') ? (
                      <video 
                        // src={`${API_URL}${media.filePath}`} 
                        // controls 
                        className="object-cover w-full h-full bg-black flex items-center justify-center"
                        // Poster boleh ditambah jika ada thumbnail
                      >
                        <source src={`${API_URL}${media.filePath}`} type={media.fileType} />
                        Browser anda tidak menyokong tag video.
                        {/* Ikon video sebagai fallback jika video tak boleh main */} 
                         <Video className="h-16 w-16 text-white absolute" />
                      </video>
                    ) : (
                      <div className="p-4">{getFileIcon(media.fileType)}</div>
                    )}
                     {/* Overlay untuk info & butang padam */} 
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
                              <AlertDialogTitle>Padam Fail Media?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tindakan ini akan memadam fail '{media.originalName}' secara kekal.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(media._id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Padam
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