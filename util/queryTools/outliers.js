/* returns true if the mandatary is an outlier and matching needs to be skipped */
const isOutlier = function (mandataris) {
  return (mandataris.normalizedName &&
    mandataris.normalizedName === 'verhofstadt' ||
    mandataris.normalizedName === 'eyskens' ||
    mandataris.normalizedName === 'saeger' ||
    mandataris.normalizedTitel === 'geens' // http://kanselarij.vo.data.gift/id/mandatarissen/8213290a-dec2-11e9-aa72-0242c0a80002
  ) ||
  (mandataris.normalizedTitel && (
    mandataris.normalizedTitel === 'minister staat' || // 'minister van staat' is normalized to this
    mandataris.normalizedTitel === 'minister buitenlandse betrekkingen' ||
    mandataris.normalizedTitel === 'minister financien' ||
    mandataris.normalizedTitel === 'eerste minister' ||
    mandataris.normalizedTitel === 'directeur - generaal' ||
    mandataris.normalizedTitel === 'bestuursdirecteur' ||
    mandataris.normalizedTitel === 'adjunct - kabinetschef' ||
    mandataris.normalizedTitel === 'adjunkt - inspekteur' ||
    mandataris.normalizedTitel === 'kabinetschef' ||
    mandataris.normalizedTitel === 'sg min vl gemeenschap' ||
    mandataris.normalizedTitel === 'raad state' || //'raad van state' is normalized to this
    mandataris.normalizedTitel === 'président - conseil de la comm. francaise' ||
    mandataris.normalizedTitel === 'minister waalse gewestexecutieve' ||
    mandataris.normalizedTitel === 'conseil de l_europe' ||
    mandataris.normalizedTitel === 'grootmaarschalk' ||
    mandataris.normalizedTitel === 'boorzitter vlaamse raad' || // this is not a typo. There's really one in there with this title: <http://kanselarij.vo.data.gift/id/mandatarissen/821d7e00-dec2-11e9-aa72-0242c0a80002">
    mandataris.normalizedTitel.indexOf('griffier') > -1 ||
    mandataris.normalizedTitel.indexOf('federaal') > -1 ||
    mandataris.normalizedTitel.indexOf('verkeerswezen') > -1 ||
    mandataris.normalizedTitel.indexOf('gouverneur') > -1 ||
    mandataris.normalizedTitel.indexOf('secretaris') > -1
  ));
};
export { isOutlier };
