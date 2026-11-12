import { BookSetupScreen } from "../screens/BookSetupScreen";
import { usePicPac } from "../state/PicPacProvider";
export default function BookSetupRoute() { return <BookSetupScreen controller={usePicPac()} />; }
