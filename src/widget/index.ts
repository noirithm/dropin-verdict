import { setAssetBase } from "./assets";
import "./element";

// widget/index.js lives one folder below the site root, so assets are at "../".
setAssetBase(new URL("../", import.meta.url).href);
