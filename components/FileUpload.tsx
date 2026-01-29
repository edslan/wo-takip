
import React from 'react';
import { BarChartBig } from 'lucide-react';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="animate-in py-20 text-center flex flex-col items-center justify-center min-h-[60vh]">
      <div className="max-w-md mx-auto space-y-8">
        <div className="inline-flex p-6 bg-white rounded-[2.5rem] shadow-2xl mb-4 border border-slate-100">
          <BarChartBig className="w-16 h-16 text-brand-600" />
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Kurumsal Bakım Yönetimi</h2>
          <p className="text-sm text-slate-500 leading-relaxed px-6">
            Veri tabanı boş görünüyor. Başlamak için sistemden aldığınız Excel veya CSV formatındaki iş emri listesini yükleyin.
          </p>
        </div>
        <label className="block w-full cursor-pointer">
            <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
            <div className="w-full py-5 bg-brand-600 hover:bg-brand-700 text-white font-extrabold rounded-2xl shadow-xl shadow-brand-100 transition-all uppercase tracking-widest text-sm flex items-center justify-center">
                EXCEL / CSV DOSYASI YÜKLE
            </div>
        </label>
      </div>
    </div>
  );
};

export default FileUpload;
