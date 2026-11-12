import { PhotoPickerScreen } from "../screens/PhotoPickerScreen";
import { usePicPac } from "../state/PicPacProvider";
export default function PhotosRoute() { return <PhotoPickerScreen controller={usePicPac()} />; }
