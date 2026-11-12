import { ProductPickerScreen } from "../screens/ProductPickerScreen";
import { usePicPac } from "../state/PicPacProvider";
export default function ProductsRoute() { return <ProductPickerScreen controller={usePicPac()} />; }
