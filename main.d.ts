export {};

interface DataFromServer {
  image_url: string;
  pose: string;
}

declare global {
    interface Window {
        dataFromServer: DataFromServer;
    }
}