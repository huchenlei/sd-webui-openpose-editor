import { createI18n } from 'vue-i18n'

const messages = {
    en: {
        ui: {
            sendPose: 'Send pose to ControlNet',
            keybinding: 'Key Bindings',
            canvas: 'Canvas',
            resizeCanvas: 'Resize Canvas',
            resetZoom: 'Reset Zoom',
            backgroundImage: 'Background Image',
            uploadImage: 'Upload Image',
            poseControl: 'Pose Control',
            addPerson: 'Add Person',
            uploadJSON: 'Upload JSON',
            downloadJSON: 'Download JSON',
            downloadImage: 'Download Image',
            addLeftHand: 'Add left hand',
            addRightHand: 'Add right hand',
            addFace: 'Add face',
        }
    },
    zh: {
        ui: {
            sendPose: '发送姿势到ControlNet',
            keybinding: '键位绑定',
            canvas: '画布',
            resizeCanvas: '调整画布大小',
            resetZoom: '重置画布缩放',
            backgroundImage: '背景图片',
            uploadImage: '上传图片',
            poseControl: '姿势控制',
            addPerson: '添加人物',
            uploadJSON: '上传JSON',
            downloadJSON: '下载JSON',
            downloadImage: '下载图片',
            addLeftHand: '添加右手',
            addRightHand: '添加左手',
            addFace: '添加脸部',
        }
    }
};

export default createI18n({
    locale: navigator.language.split('-')[0] || 'en',
    fallbackLocale: 'en',
    messages,
});
