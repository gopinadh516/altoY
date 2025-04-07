import React, { useState, useEffect } from 'react';


interface ProgressUpdate {
  status: 'started' | 'in_progress' | 'completed' | 'error';
  message: string;
  progress: number;
}

export const JsonInput: React.FC = () => {
  const [jsonData, setJsonData] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);

  useEffect(() => {
    // Listen for progress updates from the plugin
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;
      if (msg.type === 'progress_update') {
        setProgress({
          status: msg.status,
          message: msg.message,
          progress: msg.progress
        });

        if (msg.status === 'completed') {
          setTimeout(() => setProgress(null), 3000); // Clear progress after success
        }
      }
    };
  }, []);

  const handleSubmit = () => {
    try {
      const parsedData = JSON.parse(jsonData);
      parent.postMessage({ 
        pluginMessage: { 
          type: 'create-design', 
          data: parsedData 
        } 
      }, '*');
      setError(null);
    } catch (e) {
      setError('Invalid JSON format');
    }
  };

  const getExampleJson = () => {
    const example = {
      type: 'FRAME',
      name: 'Example Frame',
      width: 400,
      height: 300,
      fills: [{
        type: 'SOLID',
        color: { r: 1, g: 1, b: 1 },
        opacity: 1
      }],
      children: [
        {
          type: 'TEXT',
          name: 'Title',
          x: 20,
          y: 20,
          characters: 'Hello Figma!',
          fontSize: 24,
          fills: [{
            type: 'SOLID',
            color: { r: 0, g: 0, b: 0 },
            opacity: 1
          }]
        }
      ]
    };
    setJsonData(JSON.stringify(example, null, 2));
  };

  return (
    <div className="json-input">
      <div className="controls">
        <button onClick={getExampleJson} className="example-button">
          Load Example
        </button>
      </div>
      
      <textarea
        value={jsonData}
        onChange={(e) => setJsonData(e.target.value)}
        placeholder="Paste your Figma node JSON here..."
        className="json-textarea"
      />
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {progress && (
        <div className={`progress-bar ${progress.status}`}>
          <div 
            className="progress-fill"
            style={{ width: `${progress.progress}%` }}
          />
          <span className="progress-message">{progress.message}</span>
        </div>
      )}
      
      <button 
        onClick={handleSubmit}
        className="submit-button"
        disabled={!jsonData.trim()}
      >
        Generate Designs
      </button>
    </div>
  );
};