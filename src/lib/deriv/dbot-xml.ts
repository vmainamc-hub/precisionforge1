// Minimal DBot-compatible XML export for the visual bot builder.
// Deriv DBot uses Blockly XML with a fixed set of block types; this exporter
// produces a runnable skeleton for digit / rise-fall strategies.

export type BuilderStrategy = {
  name: string;
  description?: string;
  market: string; // e.g. R_100
  contract_type: string; // CALL | PUT | DIGITUNDER | DIGITOVER | DIGITEVEN | DIGITODD | DIGITMATCH | DIGITDIFF
  stake: number;
  duration: number;
  duration_unit: "t" | "s" | "m" | "h";
  prediction?: number; // digit contracts
  martingale?: number; // e.g. 2 = double stake on loss
  take_profit?: number | null;
  stop_loss?: number | null;
};

export function toDBotXml(s: BuilderStrategy): string {
  const barrierBlock =
    s.prediction !== undefined && s.prediction !== null
      ? `<value name="PREDICTION"><block type="math_number"><field name="NUM">${s.prediction}</field></block></value>`
      : "";
  const martingaleField =
    s.martingale && s.martingale > 1
      ? `<field name="TRADE_TYPE_LIST">${s.contract_type}</field>`
      : "";
  return `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables></variables>
  <block type="trade_definition" id="trade_def" x="0" y="0">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">${s.market}</field>
        <next>
          <block type="trade_definition_tradetype">
            <field name="TRADETYPECAT_LIST">${categoryFor(s.contract_type)}</field>
            <field name="TRADETYPE_LIST">${tradeTypeFor(s.contract_type)}</field>
            <next>
              <block type="trade_definition_contracttype">
                <field name="TYPE_LIST">${s.contract_type}</field>
                <next>
                  <block type="trade_definition_candleinterval">
                    <field name="CANDLEINTERVAL_LIST">FALSE</field>
                    <next>
                      <block type="trade_definition_restartbuysell">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror">
                            <field name="RESTARTONERROR">TRUE</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="trade_definition_tradeoptions">
        <field name="DURATIONTYPE_LIST">${s.duration_unit}</field>
        <field name="CURRENCY_LIST">USD</field>
        <value name="DURATION"><block type="math_number"><field name="NUM">${s.duration}</field></block></value>
        <value name="AMOUNT"><block type="math_number"><field name="NUM">${s.stake}</field></block></value>
        ${barrierBlock}
      </block>
    </statement>
  </block>
  <block type="before_purchase" x="0" y="300">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="purchase"><field name="PURCHASE_LIST">${s.contract_type}</field></block>
    </statement>
  </block>
  <block type="after_purchase" x="0" y="500">
    <statement name="AFTERPURCHASE_STACK">
      <block type="trade_again"></block>
    </statement>
  </block>
</xml>`;
}

function categoryFor(ct: string): string {
  if (ct === "CALL" || ct === "PUT") return "callput";
  return "digits";
}
function tradeTypeFor(ct: string): string {
  if (ct === "CALL" || ct === "PUT") return "risefall";
  if (ct === "DIGITUNDER" || ct === "DIGITOVER") return "overunder";
  if (ct === "DIGITEVEN" || ct === "DIGITODD") return "evenodd";
  if (ct === "DIGITMATCH" || ct === "DIGITDIFF") return "matchesdiffers";
  return "risefall";
}

export function downloadXml(name: string, xml: string) {
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9-_]+/gi, "_")}.xml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
