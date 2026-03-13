import React, { useState } from 'react';
import { Image as ImageIcon, Sparkles, Loader2, Download, X } from 'lucide-react';
import { apiRequest } from '@src/services/api';
import { toast } from '../services/toastService';
import { Idea } from './OrbGraph';

interface IdeaImageGeneratorProps {
  idea: Idea;
  onImageGenerated?: (ideaId: string, imageUrl: string) => void;
}

const IdeaImageGenerator: React.FC<IdeaImageGeneratorProps> = ({
  idea,
  onImageGenerated
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const generateImage = async () => {
    try {
      setIsGenerating(true);
      
      // Create prompt from idea
      const prompt = `A visual representation of: ${idea.label}. ${idea.description || ''}. Style: modern, clean, professional, concept art`;

      const response = await apiRequest('/api/images/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          provider: 'dalle',
          model: 'dall-e-3',
          size: '1024x1024',
          quality: 'standard',
          style: 'vivid',
          n: 1
        })
      });

      if (response.success && response.data?.images?.[0]?.url) {
        const imageUrl = response.data.images[0].url;
        setGeneratedImage(imageUrl);
        setShowPreview(true);
        
        if (onImageGenerated) {
          onImageGenerated(idea.id, imageUrl);
        }
        
        toast.success('Image generated successfully!');
      } else {
        throw new Error('Failed to generate image');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate image');
      console.error('Image generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `idea-${idea.id}-${Date.now()}.png`;
    link.click();
  };

  return (
    <>
      <button
        onClick={generateImage}
        disabled={isGenerating}
        className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Generate AI image for this idea"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-3 h-3" />
            Generate Image
          </>
        )}
      </button>

      {generatedImage && (
        <button
          onClick={() => setShowPreview(true)}
          className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <ImageIcon className="w-3 h-3" />
          View Image
        </button>
      )}

      {showPreview && generatedImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Generated Image: {idea.label}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadImage}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  title="Download image"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              <img
                src={generatedImage}
                alt={idea.label}
                className="max-w-full max-h-[70vh] rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default IdeaImageGenerator;

