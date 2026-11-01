i need to debug the behaviour of the main window... can you guide me step by step? I want to:
1. load a waveform
2. send the audio, frame by frame to the backend. The segmentation should happen on a buffer, which resides on the front end. The signal segment is then packed, along with meta information (or as an object) to the backend. The segment also has a time stamp, so that the front end knows when the response comes.
3. At the frontend, the responses are processed with the time stamp, or similar, in which the front end sent it. 
4. The information is then processed, the data retrieval window is updated.


-------------------------------------
