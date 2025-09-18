# Document stamping service
A service for "stamping" PDF files with the name of their associated document.

A job-like approach is used to run these operations on the PDF files. See [*The job datamodel*](#The-job-data-model) below for more info.

## Configuration snippets

#### docker-compose

```yml
document-stamping:
  image: kanselarij/document-stamping-service
  volumes:
    - ./data/files:/share
  environment:
    MU_APPLICATION_FILE_STORAGE_PATH: 'stamped-pdfs'
```

#### Dispatcher

`dispatcher.ex`:
```elixir
post "/documents/:id/stamp", @any do
  Proxy.forward conn, [], "http://document-stamping-service/documents/" <> id <> "/stamp"
end
post "/agendas/:id/agendaitems/documents/stamp", @any do
  Proxy.forward conn, [], "http://document-stamping-service/agendas/" <> id <> "/agendaitems/documents/stamp"
end
```

#### Authorization

Users of this service should have `:read`, `:write` and `:read-for-write` access to following rdf types.
```
"http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#FileDataObject"
"http://vocab.deri.ie/cogs#Job"
"http://mu.semte.ch/vocabularies/ext/FileStampingJob"
```

#### Resources

`domain.lisp`:
```lisp
(define-resource document-stamping-job ()
  :class (s-prefix "ext:FileStampingJob") ; "cogs:Job"
  :properties `((:created       :datetime  ,(s-prefix "dct:created"))
                (:status        :uri       ,(s-prefix "adms:status"))
                (:time-started  :datetime  ,(s-prefix "prov:startedAtTime"))
                (:time-ended    :datetime  ,(s-prefix "prov:endedAtTime"))
                (:message       :string    ,(s-prefix "schema:error"))
  )
  :has-many `((file              :via     ,(s-prefix "prov:used")
                                 :as "used")
              (file              :via     ,(s-prefix "prov:generated")
                                 :as "generated"))
  :resource-base (s-url "'http://example.com/id/document-stamping-jobs/")
  :features '(include-uri)
  :on-path "document-stamping-jobs"
)
```

`repository.lisp`:
```lisp
(add-prefix "ext" "http://mu.semte.ch/vocabularies/ext/")
(add-prefix "dct" "http://purl.org/dc/terms/")
(add-prefix "prov" "http://www.w3.org/ns/prov#")
(add-prefix "cogs" "http://vocab.deri.ie/cogs#")
(add-prefix "schema" "http://schema.org/")
```

`dispatcher.ex`:
```elixir
match "/document-stamping-jobs/*path", @any do
  Proxy.forward conn, path, "http://cache/document-stamping-jobs/"
end
```

## REST API
#### POST /documents/:id/stamp
Request the creation of a stamping job for one specific document

##### Response
###### 201 Created
On successful creation of a job.

```json
{
  "data": {
    "type": "document-stamping-jobs",
    "id": "5f680870-5984-11ea-98be-11315490e00b",
    "attributes": {
      "uri": "http://mu.semte.ch/services/document-stamping-service/file-stamping-jobs/5f680870-5984-11ea-98be-11315490e00b",
      "status": "http://redpencil.data.gift/id/concept/JobStatus/busy",
      "created": "2020-02-27T17:12:45.943Z"
    }
  }
}
```

###### 403 Forbidden
When the user requesting the stamping job doesn't have adequate rights.

###### 404 Not Found
When the document requested for stamping doesn't exist.

#### POST /agendas/:id/agendaitems/documents/stamp
Stamp all documents related to a specific agenda.  

##### Response
See above.

## The job data-model

For modeling the jobs that create the archive files, this service makes use of the [COGS vocabulary](http://vocab.deri.ie/cogs#Job), which in its turn is based on the [PROV-O vocabulary](https://www.w3.org/TR/2013/REC-prov-o-20130430/#prov-o-at-a-glance)
