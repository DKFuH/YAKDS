declare module 'dxf-writer' {
  class Drawing {
    static ACI: Record<string, number>;
    static UNITS: Record<string, number>;

    addLayer(name: string, colorNumber: number, lineTypeName: string): this;
    setActiveLayer(name: string): this;
    setUnits(unit: string): this;
    header(name: string, values: Array<[number, string | number]>): this;
    drawLine(x1: number, y1: number, x2: number, y2: number): this;
    drawRect(x1: number, y1: number, x2: number, y2: number): this;
    drawPolyline(points: Array<[number, number]>, closed?: boolean): this;
    toDxfString(): string;
  }

  export = Drawing;
}
