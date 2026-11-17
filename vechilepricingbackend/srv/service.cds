namespace vechilesrv;

using {vechilepricing.db as db} from '../db/schema';

service vechileprocingAPIs {

    entity RegionMasterSet        as projection on db.RegionMasterSet;
    entity ModelMasterSet         as projection on db.ModelMasterSet;
    entity PricingComponentsSet   as projection on db.PricingComponentsSet;
    entity ModelPriceBreakupSet   as projection on db.ModelPriceBreakupSet;
    entity RTOExpenseSet          as projection on db.RTOExpenseSet;
    entity RtoMasterSet           as projection on db.RtoMasterSet;
    entity GMAComponentsSet       as projection on db.GMAComponentsSet;
    entity SubmissionReferenceSet as projection on db.SubmissionReferenceSet;
    entity PartsSet               as projection on db.PartsSet;
    entity SubmissionReference    as projection on db.SubmissionReference;
    entity ApproverSet            as projection on db.ApproverSet;
    entity VariantVariableSet     as projection on db.VariantVariableSet;
    entity ReferenceNumSet        as projection on db.ReferenceNumSet;
    entity PostPriceSet           as projection on db.PostPriceSet;
    entity ModelInvalidSet        as projection on db.ModelInvalidSet;
    entity RegionInvalidSet       as projection on db.RegionInvalidSet;
    entity SubmissionReferenceRecallSet as projection on db.SubmissionReferenceRecallSet;
    entity PostPriceStatusSet as projection on db.PostPriceStatusSet;

    action getPostPriceStatus(refId : String) returns many PostPriceStatusSet;

    action checkpricingStatus () returns many String;
    // action saveToModelPriceBreakUp(items: array of ModelPriceBreakupSet) returns ModelPriceBreakupSet;

    // ── CHANGED: now returns SaveJobResult instead of ModelPriceBreakupSet ──
    // action   saveToModelPriceBreakUp(items: array of ModelPriceBreakupSet) returns SaveJobResult;

    // ── NEW: poll this to check save progress ──
    action   getSaveJobStatus(jobId: String)                               returns JobStatus;

    // submission ref - approved detail page data

    action   getApprovalDetailedData(refId: String)                        returns many ModelPriceBreakupSet;

    // ── NEW types for async save job ──────────────────────────────────────

    type SaveJobResult {
        jobId  : String;
        total  : Integer;
        status : String;
    }

    type JobStatus {
        jobId       : String;
        status      : String; // RUNNING | COMPLETED | PARTIAL | FAILED
        total       : Integer;
        done        : Integer;
        failed      : Integer;
        errors      : array of JobError;
        startedAt   : String;
        completedAt : String;
    }

    type JobError {
        chunkStart : Integer;
        chunkEnd   : Integer;
        error      : String;
    }


    // action processCalculation(nspValue: String, exshowroomPrice: String, regionCode: String, ModelCode: String, Mail: String, MTOStatus: String) returns PricingCalculationResult;

    action   processCalculation(items: array of PricingInput,
                                regionCode: String,
                                Mail: String,
                                MTOStatus: String,
                                EffectiveDate: String)                     returns array of PricingCalculationResult;

    action   goProcessing(regionCode: String,
                          MTOStatus: String,
                          Mail: String,
                          ModelCodes: array of String,
                          StatusFilter: String, // "ACTIVE", "IN-ACTIVE", "IN-STOCK"
                          EffectiveDate: String // "yyyy-MM-dd" or empty
    )                                                                      returns array of PricingCalculationResult;


    type PricingInput {
        ModelCode       : String;
        nspValue        : String;
        exshowroomPrice : String;
    }

    type PricingCalculationResult {

        Model              : String;
        OperationNo        : Integer;
        SaveInd            : String;
        Region             : String;
        MtoMts             : String;
        Basis              : String;

        DealerMargin       : Decimal(13, 2);
        InputNsp           : Decimal(13, 2);
        IncrementalNsp     : Decimal(13, 2);
        ActualNsp          : Decimal(13, 2);

        Helmet             : Decimal(13, 2);
        Transportation     : Decimal(13, 2);
        DealerCost         : Decimal(13, 2);
        OtherExpenses      : Decimal(13, 2);

        BikeMargin         : Decimal(13, 2);
        IncrementDlr       : Decimal(13, 2);
        ActualDealerMargin : Decimal(13, 2);

        HelmetMargin       : Decimal(13, 2);
        TotalDealerMargin  : Decimal(13, 2);

        Ndp                : Decimal(13, 2);
        Basic              : Decimal(13, 2);
        Gst                : Decimal(5, 2);

        InputExShowroom    : Decimal(13, 2);
        ExceptionRef       : String;

        RtoPerc            : Decimal(5, 2);
        Rto                : Decimal(13, 2);
        RtoWithBill        : Decimal(13, 2);

        InsuranceLe350     : Decimal(13, 2);
        InsuranceGt350     : Decimal(13, 2);
        Insurance          : Decimal(13, 2);
        TpaPa              : Decimal(13, 2);
        ActualGst          : Decimal(13, 2);
        TotalInsurance     : Decimal(13, 2);

        OnRoad             : Decimal(13, 2);
        ActualExShowroom   : Decimal(13, 2);
        Diff               : Decimal(13, 2);

        ReferenceNum       : String;
        GSTAfterbasic      : String;
    }

    action   addToOtherRegion(items: array of PricingInput,
                              regionCodes: array of String,
                              Mail: String,
                              MTOStatus: String,
                              StatusFilter: String, // "ACTIVE", "IN-ACTIVE", "IN-STOCK"
                              EffectiveDate: String, // "yyyy-MM-dd" or empty
                              sessionId: String)                           returns array of PricingCalculationResult;

    function ReferenceNumSets()                                            returns String;

// action addToOtherRegion(items: array of PricingInput,
//                         regionCodes: array of String)                                                                                        returns array of ModelPriceBreakupSet;



type MiyPart {
    PartCode         : String(100);
    Description      : String(200);
    ExShowOnRoad     : String(20);
    MiyCost          : Decimal(15, 3);
    MiyMarkup        : Decimal(15, 3);
    PartPrice        : Decimal(15, 3);
    ExShowroomBefore : Decimal(15, 3);
    ExShowroomAfter  : Decimal(15, 3);
}

type PriceBreakupItem {
    // ── identifiers / text ──
    Mail               : String;
    AsmName            : String;
    Model              : String;
    ModelName          : String;
    Region             : String;
    RegionName         : String;
    OperationNo        : Integer;
    SaveInd            : String;
    MtoMts             : String;
    Basis              : String;
    ReferenceNum       : String;
    ExceptionRef       : String;
    ReferenceMtsModel  : String;

    // ── common pricing ──
    DealerMargPerc     : Decimal(15, 3);
    DealerMargin       : Decimal(15, 3);
    InputNsp           : Decimal(15, 3);
    IncrementalNsp     : Decimal(15, 3);
    ActualNsp          : Decimal(15, 3);
    Helmet             : Decimal(15, 3);
    Transportation     : Decimal(15, 3);
    DealerCost         : Decimal(15, 3);
    OtherExpenses      : Decimal(15, 3);
    BikeMargin         : Decimal(15, 3);
    IncrementDlr       : Decimal(15, 3);
    ActualDealerMargin : Decimal(15, 3);
    HelmetMargin       : Decimal(15, 3);
    TotalDealerMargin  : Decimal(15, 3);
    Ndp                : Decimal(15, 3);
    Basic              : Decimal(15, 3);
    GstPerc            : Decimal(15, 3);
    Gst                : Decimal(15, 3);
    GstAftBasic        : Decimal(15, 3);
    InputExShowroom    : Decimal(15, 3);
    ActualExShowroom   : Decimal(15, 3);
    RtoPerc            : Decimal(15, 3);
    Rto                : Decimal(15, 3);
    RtoWithBill        : Decimal(15, 3);
    InsuranceLe350     : Decimal(15, 6);
    InsuranceGt350     : Decimal(15, 6);
    InsurancePerc      : Decimal(15, 6);
    Insurance          : Decimal(15, 6);
    TpaPa              : Decimal(15, 3);
    InsuranceGst       : Decimal(15, 3);
    ActualGst          : Decimal(15, 3);
    TotalInsurance     : Decimal(15, 6);
    OnRoad             : Decimal(15, 3);
    Diff               : Decimal(15, 3);

    // ── MTO ──
    MtoNsp             : Decimal(15, 3);
    MtsExshwroom       : Decimal(15, 3);
    MtsOnRoad          : Decimal(15, 3);
    MtoExShwroom       : Decimal(15, 3);
    MtoOnRoad          : Decimal(15, 3);
    MtoExShwAftGma     : Decimal(15, 3);
    MiyExshowroom      : Decimal(15, 3);
    MiyOnroad          : Decimal(15, 3);
    ExpExshowroom      : Decimal(15, 3);
    ExpOnroad          : Decimal(15, 3);
    MiyBreakup         : many MiyPart;

    // ── CSD ──
    CsdNsp             : Decimal(15, 3);
    BasicPriceWo       : Decimal(15, 3);
    CsdDiscPerc        : Decimal(15, 3);
    Csd                : Decimal(15, 3);
    PretaxNetDisc      : Decimal(15, 3);
    CsdGstPerc         : Decimal(15, 3);
    CsdGstAmount       : Decimal(15, 3);
    CsdExshwroom       : Decimal(15, 3);
    IncidentalPerc     : Decimal(15, 3);
    IncidentalCharges  : Decimal(15, 3);
    FinalCsdPrice      : Decimal(15, 3);
    CsdOnroad          : Decimal(15, 3);

    // ── GeM ──
    DiscPerc           : Decimal(15, 3);
    DiscAmount         : Decimal(15, 3);
    SubTotal           : Decimal(15, 3);
    GemGstPerc         : Decimal(15, 3);
    HelmetCost         : Decimal(15, 3);
    GemBasic           : Decimal(15, 3);
    GemGstAmount       : Decimal(15, 3);
    FinalGemPrice      : Decimal(15, 3);
}

action saveToModelPriceBreakUp(items: array of PriceBreakupItem) returns SaveJobResult;




}


