// using {vechilePricing  } from '@sap/cds/common';

using {vechilePricing as s4} from '../srv/external/vechilePricing.csn';


namespace vechilepricing.db;


entity RegionMasterSet        as projection on s4.RegionMasterSet;
entity ModelMasterSet         as projection on s4.ModelMasterSet;
entity PricingComponentsSet   as projection on s4.PricingComponentsSet;
entity ModelPriceBreakupSet   as projection on s4.ModelPriceBreakupSet;
entity RTOExpenseSet          as projection on s4.RTOExpenseSet;
entity RtoMasterSet           as projection on s4.RtoMasterSet;
entity GMAComponentsSet       as projection on s4.GMAComponentsSet;
entity SubmissionReferenceSet as projection on s4.SubmissionReferenceSet;
entity PartsSet               as projection on s4.PartsSet;
entity SubmissionReference    as projection on s4.SubmissionReferenceSet;
entity ApproverSet            as projection on s4.ApproverSet;
entity VariantVariableSet     as projection on s4.VariantVariableSet;
entity ReferenceNumSet        as projection on s4.ReferenceNumSet;
entity PostPriceSet           as projection on s4.PostPriceSet;
entity ModelInvalidSet        as projection on s4.ModelInvalidSet;
entity RegionInvalidSet       as projection on s4.RegionInvalidSet;
entity SubmissionReferenceRecallSet as projection on s4.SubmissionReferenceRecallSet;
entity PostPriceStatusSet as projection on s4.PostPriceStatusSet;

